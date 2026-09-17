import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { GhostButton } from '../../components/UiPrimitives';
import { routes } from '../../lib/routes';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';

const SolidGeometryCanvas = lazy(() => import('../../components/SolidGeometryCanvas'));
const MATH_FORMULAS_PATH = `${routes.cscaSubjects}/math/formulas`;
const MATH_VISUALIZERS_PATH = `${routes.cscaSubjects}/math/visualize`;

function subjectPath(subject: string) {
  return `${routes.cscaSubjects}/${subject}`;
}

function formulaPath(sectionId?: string) {
  return sectionId ? `${MATH_FORMULAS_PATH}#${sectionId}` : MATH_FORMULAS_PATH;
}

class SolidGeometryCanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Solid geometry canvas failed to render', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTrigValue(value: number | null, copy: Pick<TrigCopy, 'undefinedValue' | 'outOfRangeValue'>) {
  if (value === null || !Number.isFinite(value)) return copy.undefinedValue;
  if (Math.abs(value) >= 10) return copy.outOfRangeValue;
  return value.toFixed(4);
}

function buildWavePath(fn: (x: number) => number | null, width: number, height: number, yLimit = 1.25) {
  const steps = 240;
  const parts: string[] = [];
  let open = false;
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const radians = ratio * Math.PI * 2;
    const value = fn(radians);
    if (value === null || !Number.isFinite(value) || Math.abs(value) > yLimit) {
      open = false;
      continue;
    }
    const x = ratio * width;
    const y = height / 2 - (value / yLimit) * (height * 0.42);
    parts.push(`${open ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    open = true;
  }
  return parts.join(' ');
}

type FunctionBaseKey = 'square' | 'sin' | 'abs' | 'sqrt';
type SetOperationKey = 'union' | 'intersection' | 'aMinusB' | 'bMinusA' | 'aComplement' | 'bComplement' | 'symmetricDifference';
type ElementaryFunctionKey = 'linear' | 'quadratic' | 'exponential' | 'logarithmic' | 'power';
type InequalityMode = 'linear' | 'quadratic';
type InequalityComparator = '>' | '>=' | '<' | '<=';
type SequenceMode = 'arithmetic' | 'geometric';
type ConicMode = 'ellipse' | 'parabola' | 'hyperbola';
type SolidMode = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere' | 'prism';
type CalculusMode = 'derivative' | 'integral';

type TrigCopy = {
  unitCircleAria: string;
  graphAria: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  viewFormulas: string;
  legendAria: string;
  dashedLegend: string;
  sinLegend: string;
  cosLegend: string;
  tanLegend: string;
  angle: string;
  angleAria: string;
  tanUndefinedWarning: string;
  tanOutOfRangeWarning: string;
  undefinedValue: string;
  outOfRangeValue: string;
  coreFormula: string;
  coreFormulaBody: ReactNode;
  viewTrigFormulas: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  backToMathPractice: string;
};

const TRIG_COPY: LocalizedMap<TrigCopy> = {
  'zh-CN': {
    unitCircleAria: '单位圆三角函数图像',
    graphAria: '三角函数曲线',
    back: '← 返回数学练习',
    kicker: '交互式模拟 / 数学',
    title: '三角函数与单位圆交互演示',
    body: '拖动角度，观察单位圆坐标、函数曲线和 tan 切线长度如何同时变化。',
    viewFormulas: '查看公式',
    legendAria: '三角函数图例',
    dashedLegend: '虚线单位圆 / tan 渐近线',
    sinLegend: 'sin 纵坐标与正弦曲线',
    cosLegend: 'cos 横坐标与余弦曲线',
    tanLegend: 'tan 切线长度与正切曲线',
    angle: '角度 θ',
    angleAria: '角度 θ',
    tanUndefinedWarning: 'tan 未定义：此时 cos θ = 0，终边与切线平行。',
    tanOutOfRangeWarning: 'tan 超出显示范围：图中已裁切切线长度。',
    undefinedValue: '未定义',
    outOfRangeValue: '超出显示范围',
    coreFormula: '核心公式',
    coreFormulaBody: <>单位圆上点为 <b>P(cos θ, sin θ)</b>，所以 sin 是纵坐标，cos 是横坐标；tan 是终边斜率。</>,
    viewTrigFormulas: '查看三角函数公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '理解图像关系后，可以回到函数与几何模块做智能练习，把概念转成解题速度。',
    backToMathPractice: '回到数学练习',
  },
  en: {
    unitCircleAria: 'Unit circle trigonometric function diagram',
    graphAria: 'Trigonometric function curves',
    back: '← Back to Math Practice',
    kicker: 'Interactive Simulation / Math',
    title: 'Trigonometric Functions and Unit Circle',
    body: 'Drag the angle to see unit-circle coordinates, function curves, and tangent length change together.',
    viewFormulas: 'View Formulas',
    legendAria: 'Trigonometric function legend',
    dashedLegend: 'Dashed unit circle / tan asymptote',
    sinLegend: 'sin vertical coordinate and sine curve',
    cosLegend: 'cos horizontal coordinate and cosine curve',
    tanLegend: 'tan tangent length and tangent curve',
    angle: 'Angle θ',
    angleAria: 'Angle theta',
    tanUndefinedWarning: 'tan is undefined: cos θ = 0, so the terminal side is parallel to the tangent line.',
    tanOutOfRangeWarning: 'tan is outside the display range: tangent length is clipped in the graph.',
    undefinedValue: 'Undefined',
    outOfRangeValue: 'Outside display range',
    coreFormula: 'Core Formula',
    coreFormulaBody: <>A point on the unit circle is <b>P(cos θ, sin θ)</b>, so sin is the vertical coordinate, cos is the horizontal coordinate, and tan is the terminal-side slope.</>,
    viewTrigFormulas: 'View Trigonometry Formulas',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'After reviewing the graph relationships, return to functions and geometry practice to turn concepts into solving speed.',
    backToMathPractice: 'Back to Math Practice',
  },
};

TRIG_COPY.vi = {
  ...TRIG_COPY.en!,
  unitCircleAria: 'Sơ đồ hàm lượng giác trên đường tròn đơn vị',
  graphAria: 'Đồ thị hàm lượng giác',
  back: '← Quay lại luyện Toán',
  kicker: 'Mô phỏng tương tác / Toán',
  title: 'Hàm lượng giác và đường tròn đơn vị',
  body: 'Kéo góc để quan sát tọa độ trên đường tròn đơn vị, đồ thị hàm số và độ dài tiếp tuyến thay đổi cùng lúc.',
  viewFormulas: 'Xem công thức',
  legendAria: 'Chú giải hàm lượng giác',
  dashedLegend: 'Đường tròn đơn vị nét đứt / tiệm cận tan',
  sinLegend: 'Tọa độ dọc sin và đồ thị sin',
  cosLegend: 'Tọa độ ngang cos và đồ thị cos',
  tanLegend: 'Độ dài tiếp tuyến tan và đồ thị tan',
  angle: 'Góc θ',
  angleAria: 'Góc theta',
  tanUndefinedWarning: 'tan không xác định: cos θ = 0, nên tia cuối song song với tiếp tuyến.',
  tanOutOfRangeWarning: 'tan nằm ngoài vùng hiển thị: độ dài tiếp tuyến đã được cắt trên đồ thị.',
  undefinedValue: 'Không xác định',
  outOfRangeValue: 'Ngoài vùng hiển thị',
  coreFormula: 'Công thức cốt lõi',
  coreFormulaBody: <>Một điểm trên đường tròn đơn vị là <b>P(cos θ, sin θ)</b>, nên sin là tọa độ dọc, cos là tọa độ ngang, còn tan là độ dốc của tia cuối.</>,
  viewTrigFormulas: 'Xem công thức lượng giác',
  relatedPractice: 'Luyện tập liên quan',
  relatedPracticeBody: 'Sau khi hiểu quan hệ đồ thị, quay lại luyện hàm số và hình học để biến khái niệm thành tốc độ giải bài.',
  backToMathPractice: 'Quay lại luyện Toán',
};

type FunctionTransformCopy = {
  graphAria: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  viewFormulas: string;
  baseFunction: string;
  originalFunction: string;
  visualNote: string;
  parameterAria: (key: string) => string;
  showOriginal: string;
  reset: string;
  quickReference: string;
  quickReferenceBody: ReactNode;
  legendAria: string;
  baseLegend: string;
  transformedLegend: string;
  axesLegend: string;
  howToRead: string;
  howToReadBody: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  backToMathPractice: string;
};

const FUNCTION_TRANSFORM_COPY: LocalizedMap<FunctionTransformCopy> = {
  'zh-CN': {
    graphAria: '函数图像变换',
    back: '← 返回全部模拟',
    kicker: '交互式模拟 / 函数',
    title: '函数图像变换交互演示',
    body: '切换基函数并拖动参数，观察平移、伸缩和翻折如何改变图像。',
    viewFormulas: '查看公式',
    baseFunction: '基函数',
    originalFunction: '原函数',
    visualNote: '灰色虚线是变换前的基准图像，蓝色实线是当前参数的变换结果。',
    parameterAria: (key) => `参数 ${key}`,
    showOriginal: '显示原函数虚线',
    reset: '重置',
    quickReference: '快速参考',
    quickReferenceBody: <><b>a</b> 控制纵向伸缩和上下翻折；<b>b</b> 控制横向伸缩和左右翻折；<b>c</b> 先影响函数内部，<b>d</b> 直接上下平移。</>,
    legendAria: '函数图像图例',
    baseLegend: '原函数 f(x)',
    transformedLegend: '变换后 y=a·f(bx+c)+d',
    axesLegend: '坐标轴与刻度',
    howToRead: '如何看图像变化',
    howToReadBody: '先只改一个参数观察方向，再组合参数。根号函数会自动断开无定义部分，避免把不存在的图像连起来。',
    relatedPractice: '相关练习',
    relatedPracticeBody: '函数图像变换常和定义域、单调性、对称性一起考，建议看完后回到数学练习。',
    backToMathPractice: '回到数学练习',
  },
  en: {
    graphAria: 'Function transformation graph',
    back: '← Back to Simulations',
    kicker: 'Interactive Simulation / Functions',
    title: 'Function Transformations',
    body: 'Switch base functions and drag parameters to see how shifts, stretches, and reflections change the graph.',
    viewFormulas: 'View Formulas',
    baseFunction: 'Base Function',
    originalFunction: 'Base Function',
    visualNote: 'The gray dashed curve is the base graph; the blue solid curve is the transformed result.',
    parameterAria: (key) => `Parameter ${key}`,
    showOriginal: 'Show base function dashed curve',
    reset: 'Reset',
    quickReference: 'Quick Reference',
    quickReferenceBody: <><b>a</b> controls vertical stretch and reflection; <b>b</b> controls horizontal stretch and reflection; <b>c</b> shifts inside the input; <b>d</b> shifts the graph up or down.</>,
    legendAria: 'Function graph legend',
    baseLegend: 'Base function f(x)',
    transformedLegend: 'Transformed y=a·f(bx+c)+d',
    axesLegend: 'Axes and ticks',
    howToRead: 'How to Read the Change',
    howToReadBody: 'Change one parameter at a time first, then combine parameters. Square-root graphs automatically break where undefined.',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Function transformations often appear with domains, monotonicity, and symmetry. Return to function practice after reviewing.',
    backToMathPractice: 'Back to Math Practice',
  },
};

FUNCTION_TRANSFORM_COPY.vi = {
  ...FUNCTION_TRANSFORM_COPY.en!,
  graphAria: 'Đồ thị biến đổi hàm số',
  back: '← Quay lại mô phỏng',
  kicker: 'Mô phỏng tương tác / Hàm số',
  title: 'Biến đổi đồ thị hàm số',
  body: 'Đổi hàm cơ sở và kéo tham số để thấy tịnh tiến, co giãn và đối xứng làm đồ thị thay đổi như thế nào.',
  viewFormulas: 'Xem công thức',
  baseFunction: 'Hàm cơ sở',
  originalFunction: 'Hàm cơ sở',
  visualNote: 'Đường nét đứt màu xám là đồ thị gốc; đường liền màu xanh là kết quả sau biến đổi.',
  parameterAria: (key) => `Tham số ${key}`,
  showOriginal: 'Hiển thị đồ thị gốc nét đứt',
  reset: 'Đặt lại',
  quickReference: 'Tham khảo nhanh',
  quickReferenceBody: <><b>a</b> điều khiển co giãn dọc và đối xứng; <b>b</b> điều khiển co giãn ngang và đối xứng; <b>c</b> dịch bên trong đầu vào; <b>d</b> dịch đồ thị lên hoặc xuống.</>,
  legendAria: 'Chú giải đồ thị hàm số',
  baseLegend: 'Hàm cơ sở f(x)',
  transformedLegend: 'Biến đổi y=a·f(bx+c)+d',
  axesLegend: 'Trục và vạch chia',
  howToRead: 'Cách đọc biến đổi',
  howToReadBody: 'Trước tiên chỉ thay một tham số, sau đó mới kết hợp. Đồ thị căn bậc hai tự ngắt ở phần không xác định.',
  relatedPractice: 'Luyện tập liên quan',
  relatedPracticeBody: 'Biến đổi hàm số thường đi cùng miền xác định, tính đơn điệu và đối xứng. Sau khi xem, quay lại luyện theo môn phần hàm số.',
  backToMathPractice: 'Quay lại luyện Toán',
};

const MATH_VISUALIZER_COPY: LocalizedMap<Record<string, any>> = {
  'zh-CN': {
    common: {
      back: '← 返回全部模拟',
      viewFormulas: '查看公式',
      relatedPractice: '相关练习',
      backToMathPractice: '回到数学练习',
    },
    elementary: {
      graphAria: '初等函数对比图',
      kicker: '交互式模拟 / 函数',
      title: '初等函数对比交互演示',
      body: '把一次、二次、指数、对数、幂函数放在同一坐标系中，对比定义域、增长速度和图像形状。',
      showing: '当前显示：',
      selectFunction: '请选择函数',
      displayedFunctions: '显示函数',
      functions: {
        linear: { label: '一次函数', description: '斜率决定方向，截距决定与 y 轴交点。' },
        quadratic: { label: '二次函数', description: '顶点、开口方向和宽窄是观察重点。' },
        exponential: { label: '指数函数', description: '底数大于 1 时递增，靠近 x 轴但不相交。' },
        logarithmic: { label: '对数函数', description: '定义域为 x>0，是指数函数的反函数。' },
        power: { label: '幂函数', description: '指数 p 改变增长速度和曲线形状。' },
      },
      baseAria: '底数 a',
      slopeAria: '斜率 k',
      shiftAria: '平移参数',
      exponentAria: '幂指数 p',
      observationOrder: '观察顺序',
      observationBody: '先看定义域：对数函数只在 x>0；再看增长速度：指数函数最终通常比一次、二次更快。',
      legendAria: '初等函数图例',
      cscaUse: '考点怎么用',
      cscaUseBody: 'CSCA 常考函数图像、定义域、单调性和交点判断。把曲线叠在一起，比只背形状更容易判断增长趋势。',
      relatedBody: '看完对比后，建议回到函数模块练定义域、图像性质和参数判断。',
    },
    inequality: {
      graphAria: '不等式函数图像',
      numberLineAria: '不等式解集数轴',
      kicker: '交互式模拟 / 不等式',
      title: '不等式解集可视化',
      body: '把代数不等式映射到函数图像和数轴上，理解边界点、开闭端点和区间表达。',
      type: '类型',
      linear: '一次不等式',
      quadratic: '二次不等式',
      comparison: '比较',
      linearA: '一次项系数 a',
      constantB: '常数项 b',
      quadraticP: '二次项参数 p',
      quadraticQ: '二次项参数 q',
      solutionSet: '解集',
      allReals: '全体实数 R',
      emptySet: '空集 ∅',
      or: '或',
      resultBody: '图中橙色短线表示满足不等式的 x 值；数轴端点为空心代表不包含，实心代表包含。',
      legendAria: '不等式图例',
      functionGraph: '函数图像',
      satisfyingX: '满足不等式的 x',
      endpointExcluded: '不含端点',
      endpointIncluded: '包含端点',
      boundaries: '怎么判断边界',
      boundariesBody: '先把等号对应的点找出来，再看图像在 x 轴上方还是下方。带等号时端点实心，不带等号时端点空心。',
      relatedBody: '一次和二次不等式常与函数图像、区间和集合表示一起出现，建议回到集合与不等式模块巩固。',
    },
    sequence: {
      svgAria: '数列项值图',
      kicker: '交互式模拟 / 数列',
      title: '数列可视化：等差与等比数列',
      body: '观察每一项如何变化，并把项值增长和前 n 项和联系起来。',
      arithmetic: '等差数列',
      geometric: '等比数列',
      firstTerm: '首项',
      commonDifference: '公差',
      commonRatio: '公比',
      termCount: '项数 n',
      partialSum: '前 n 项和',
      resultBody: '等差看“固定增加”，等比看“按比例放大或缩小”。',
      positiveTerm: '正项',
      negativeTerm: '负项',
      termPosition: '第 n 项位置',
    },
    probability: {
      svgAria: '概率收敛模拟',
      targetProbability: '理论概率',
      frequency: '频率',
      trials: '试验次数',
      kicker: '交互式模拟 / 概率统计',
      title: '概率统计模拟器',
      body: '用重复试验观察频率如何靠近理论概率，理解随机波动和长期稳定性。',
      currentFrequency: '当前频率',
      probabilityAria: '理论概率 p',
      trialsAria: '试验次数 n',
      runAgain: '重新模拟',
      roundResult: '本轮结果',
      hitsResult: (hits: number, trials: number) => `${hits} 次命中 / ${trials} 次试验`,
      resultBody: '次数越多，曲线通常越靠近理论概率线，但局部仍会波动。',
      cumulativeFrequency: '累计频率',
      theoreticalProbability: '理论概率',
    },
    vector: {
      svgAria: '向量运算图',
      kicker: '交互式模拟 / 向量',
      title: '向量运算交互演示',
      body: '调整两个向量的分量，观察加法平行四边形、数量积和夹角的变化。',
      angle: '夹角',
      vectorAria: (key: string) => `向量 ${key}`,
      componentResult: '分量结果',
      resultBody: '点积为正通常夹角锐，点积为负通常夹角钝，点积为 0 时两向量垂直。',
      vectorA: '向量 a',
      vectorB: '向量 b',
      guides: '平行四边形辅助线',
    },
    conic: {
      svgAria: '圆锥曲线图',
      kicker: '交互式模拟 / 解析几何',
      title: '圆锥曲线交互演示',
      body: '切换椭圆、抛物线和双曲线，观察参数如何改变曲线形状与焦点位置。',
      modes: { ellipse: '椭圆', parabola: '抛物线', hyperbola: '双曲线' },
      semiAxisA: '半轴 a',
      semiAxisB: '半轴 b',
      focalParameter: '焦参数 p',
      observationFocus: '观察重点',
      focusText: { ellipse: '焦点在长轴上', parabola: 'p 控制开口宽窄', hyperbola: '虚线是渐近线' },
      resultBody: '先分辨标准方程形式，再观察参数对图像宽窄、开口和焦点的影响。',
      curve: '曲线',
      focus: '焦点',
      guide: '渐近线/辅助线',
    },
    coordinate: {
      svgAria: '空间坐标系图',
      kicker: '交互式模拟 / 空间坐标',
      title: '空间坐标系交互演示',
      body: '调整 A、B 两点坐标，实时查看空间距离和中点坐标。',
      pointAria: (point: string, key: string) => `${point} 点 ${key}`,
      formula: '计算公式',
      resultBody: '中点坐标分别取三个坐标分量的平均值。',
      pointA: '点 A',
      pointB: '点 B',
      segment: '线段 AB',
    },
    solid: {
      kicker: '交互式模拟 / 立体几何',
      title: '立体几何 3D 图形探索',
      body: '切换常见立体图形，调整尺寸，实时观察体积和表面积。',
      modes: { cube: '正方体', cuboid: '长方体', cylinder: '圆柱', cone: '圆锥', sphere: '球', prism: '三棱柱' },
      labels: { length: '长', width: '宽', height: '高', base: '底' },
      arias: { side: '边长', length: '长度', width: '宽度', height: '高度', radius: '半径', base: '底边', triangleHeight: '三角形高', prismLength: '棱柱长' },
      result: '结果',
      volume: '体积',
      surfaceArea: '表面积',
      resultBody: '考试中先识别图形，再代入对应公式；组合体要拆成基本图形。',
      loadError: '3D 视图暂时无法加载，请刷新页面或稍后重试。',
      loading: '正在加载 3D 视图...',
      mainSolid: '主体',
      axesGuides: '坐标轴 / 辅助线',
      transparentSurface: '半透明表面',
      resetView: '重置视角',
    },
    calculus: {
      svgAria: '微积分图像',
      kicker: '交互式模拟 / 微积分',
      title: '微积分可视化：导数与积分',
      body: '拖动点看切线斜率，调整区间看有符号面积，建立导数与积分的直观理解。',
      derivative: '导数 / 切线',
      integral: '积分 / 有符号面积',
      currentFunction: '当前函数',
      tangentPoint: '切点 x',
      integralLeft: '积分左端',
      integralRight: '积分右端',
      keyIdea: '理解重点',
      keyIdeaText: { derivative: '切线斜率表示瞬时变化率', integral: '有符号面积表示累积量' },
      resultBody: 'CSCA 不一定深考微积分，但这种图形理解能帮助读懂函数变化趋势。',
      functionCurve: '函数曲线',
      tangentLine: '切线',
      signedArea: '有符号面积',
    },
    set: {
      svgAria: '集合运算韦恩图',
      kicker: '交互式模拟 / 集合',
      title: '集合运算韦恩图交互演示',
      body: '切换集合运算，观察区域高亮和结果元素如何对应。',
      operation: '运算',
      currentResult: '当前结果',
      deMorgan: '德摩根定律',
      operations: {
        union: { name: '并集', description: '属于 A 或属于 B 的元素都会被保留。' },
        intersection: { name: '交集', description: '只保留同时属于 A 和 B 的公共元素。' },
        aMinusB: { name: '差集 A\\B', description: '保留属于 A 但不属于 B 的元素。' },
        bMinusA: { name: '差集 B\\A', description: '保留属于 B 但不属于 A 的元素。' },
        aComplement: { name: 'A 的补集', description: '在全集 U 中，所有不属于 A 的元素。' },
        bComplement: { name: 'B 的补集', description: '在全集 U 中，所有不属于 B 的元素。' },
        symmetricDifference: { name: '对称差', description: '保留只属于 A 或只属于 B，但不同时属于两者的元素。' },
      },
      legendAria: '集合韦恩图图例',
      onlyA: '只属于 A',
      onlyB: '只属于 B',
      intersection: 'A 与 B 的交集',
      outside: '全集中不属于当前集合的区域',
      universalSet: '全集',
      readVenn: '如何读韦恩图',
      readVennBody: '先分清只属于 A、只属于 B、同时属于两者、均不属于四个区域，再根据运算保留对应区域。',
      relatedBody: '集合运算常与补集、子集、元素个数一起考，建议做集合与不等式模块巩固。',
    },
  },
  en: {
    common: {
      back: '← Back to Simulations',
      viewFormulas: 'View Formulas',
      relatedPractice: 'Related Practice',
      backToMathPractice: 'Back to Math Practice',
    },
    elementary: {
      graphAria: 'Elementary function comparison graph',
      kicker: 'Interactive Simulation / Functions',
      title: 'Elementary Function Comparison',
      body: 'Compare linear, quadratic, exponential, logarithmic, and power functions in one coordinate plane.',
      showing: 'Showing: ',
      selectFunction: 'Select a function',
      displayedFunctions: 'Displayed Functions',
      functions: {
        linear: { label: 'Linear Function', description: 'Slope controls direction; intercept controls where the graph crosses the y-axis.' },
        quadratic: { label: 'Quadratic Function', description: 'Vertex, opening direction, and width are the key features.' },
        exponential: { label: 'Exponential Function', description: 'When the base is greater than 1, the graph increases and approaches the x-axis.' },
        logarithmic: { label: 'Logarithmic Function', description: 'Domain is x > 0; it is the inverse of an exponential function.' },
        power: { label: 'Power Function', description: 'The exponent p changes growth rate and curve shape.' },
      },
      baseAria: 'Base a',
      slopeAria: 'Slope k',
      shiftAria: 'Shift parameter',
      exponentAria: 'Power exponent p',
      observationOrder: 'Observation Order',
      observationBody: 'Start with domain: logarithmic functions only exist for x > 0. Then compare growth: exponential functions usually outpace linear and quadratic ones eventually.',
      legendAria: 'Elementary function legend',
      cscaUse: 'How This Appears in CSCA',
      cscaUseBody: 'CSCA often checks graphs, domains, monotonicity, and intersections. Comparing curves directly makes growth trends easier to judge.',
      relatedBody: 'After comparing functions, return to the functions module for domains, graph properties, and parameter questions.',
    },
    inequality: {
      graphAria: 'Inequality function graph',
      numberLineAria: 'Inequality solution number line',
      kicker: 'Interactive Simulation / Inequalities',
      title: 'Inequality Solution Visualizer',
      body: 'Map algebraic inequalities onto a graph and number line to understand boundaries, open/closed endpoints, and interval notation.',
      type: 'Type',
      linear: 'Linear Inequality',
      quadratic: 'Quadratic Inequality',
      comparison: 'Comparison',
      linearA: 'Linear coefficient a',
      constantB: 'Constant term b',
      quadraticP: 'Quadratic parameter p',
      quadraticQ: 'Quadratic parameter q',
      solutionSet: 'Solution Set',
      allReals: 'All real numbers R',
      emptySet: 'Empty set ∅',
      or: 'or',
      resultBody: 'Orange ticks mark x-values that satisfy the inequality. Open endpoints are excluded; filled endpoints are included.',
      legendAria: 'Inequality legend',
      functionGraph: 'Function graph',
      satisfyingX: 'x-values satisfying the inequality',
      endpointExcluded: 'Endpoint excluded',
      endpointIncluded: 'Endpoint included',
      boundaries: 'How to Judge Boundaries',
      boundariesBody: 'First find the equality boundary, then check whether the graph is above or below the x-axis. Endpoints are filled when equality is included and open otherwise.',
      relatedBody: 'Linear and quadratic inequalities often combine graphs, intervals, and set notation. Return to sets and inequalities practice to reinforce them.',
    },
    sequence: {
      svgAria: 'Sequence term value chart',
      kicker: 'Interactive Simulation / Sequences',
      title: 'Sequence Visualizer: Arithmetic and Geometric',
      body: 'Watch each term change and connect term growth with the partial sum.',
      arithmetic: 'Arithmetic Sequence',
      geometric: 'Geometric Sequence',
      firstTerm: 'First term',
      commonDifference: 'Common difference',
      commonRatio: 'Common ratio',
      termCount: 'Number of terms n',
      partialSum: 'Partial Sum',
      resultBody: 'Arithmetic sequences add a fixed amount; geometric sequences scale by a fixed ratio.',
      positiveTerm: 'Positive term',
      negativeTerm: 'Negative term',
      termPosition: 'Term position n',
    },
    probability: {
      svgAria: 'Probability convergence simulation',
      targetProbability: 'Target probability',
      frequency: 'Frequency',
      trials: 'Trials',
      kicker: 'Interactive Simulation / Probability',
      title: 'Probability Simulator',
      body: 'Use repeated trials to see frequency move toward theoretical probability while still fluctuating locally.',
      currentFrequency: 'current frequency',
      probabilityAria: 'Theoretical probability p',
      trialsAria: 'Number of trials n',
      runAgain: 'Run Again',
      roundResult: 'Round Result',
      hitsResult: (hits: number, trials: number) => `${hits} hits / ${trials} trials`,
      resultBody: 'With more trials, the curve usually moves closer to the theoretical probability line, though local fluctuation remains.',
      cumulativeFrequency: 'Cumulative frequency',
      theoreticalProbability: 'Theoretical probability',
    },
    vector: {
      svgAria: 'Vector operations diagram',
      kicker: 'Interactive Simulation / Vectors',
      title: 'Vector Operations',
      body: 'Adjust two vector components and observe vector addition, dot product, and angle changes.',
      angle: 'angle',
      vectorAria: (key: string) => `Vector ${key}`,
      componentResult: 'Component Result',
      resultBody: 'A positive dot product usually means an acute angle; a negative dot product means an obtuse angle; zero means perpendicular vectors.',
      vectorA: 'Vector a',
      vectorB: 'Vector b',
      guides: 'Parallelogram guides',
    },
    conic: {
      svgAria: 'Conic sections graph',
      kicker: 'Interactive Simulation / Analytic Geometry',
      title: 'Conic Sections',
      body: 'Switch between ellipses, parabolas, and hyperbolas to see how parameters change shape and focus position.',
      modes: { ellipse: 'Ellipse', parabola: 'Parabola', hyperbola: 'Hyperbola' },
      semiAxisA: 'Semi-axis a',
      semiAxisB: 'Semi-axis b',
      focalParameter: 'Focal parameter p',
      observationFocus: 'Observation Focus',
      focusText: { ellipse: 'Foci lie on the major axis', parabola: 'p controls opening width', hyperbola: 'Dashed lines are asymptotes' },
      resultBody: 'Identify the standard equation first, then observe how parameters affect width, opening, and foci.',
      curve: 'Curve',
      focus: 'Focus',
      guide: 'Asymptote / guide',
    },
    coordinate: {
      svgAria: '3D coordinate diagram',
      kicker: 'Interactive Simulation / Coordinates',
      title: '3D Coordinate Geometry',
      body: 'Adjust points A and B to see distance and midpoint coordinates update in real time.',
      pointAria: (point: string, key: string) => `Point ${point} ${key}`,
      formula: 'Formula',
      resultBody: 'The midpoint coordinate is the average of each coordinate component.',
      pointA: 'Point A',
      pointB: 'Point B',
      segment: 'Segment AB',
    },
    solid: {
      kicker: 'Interactive Simulation / Solid Geometry',
      title: '3D Solid Geometry Explorer',
      body: 'Switch common solids, adjust dimensions, and watch volume and surface area update.',
      modes: { cube: 'Cube', cuboid: 'Cuboid', cylinder: 'Cylinder', cone: 'Cone', sphere: 'Sphere', prism: 'Triangular Prism' },
      labels: { length: 'Length', width: 'Width', height: 'Height', base: 'Base' },
      arias: { side: 'Side length', length: 'Length', width: 'Width', height: 'Height', radius: 'Radius', base: 'Base edge', triangleHeight: 'Triangle height', prismLength: 'Prism length' },
      result: 'Result',
      volume: 'Volume',
      surfaceArea: 'Surface area',
      resultBody: 'In exams, identify the solid first, then apply the matching formula. Composite solids should be split into basic shapes.',
      loadError: 'The 3D view cannot load right now. Refresh or try again later.',
      loading: 'Loading 3D view...',
      mainSolid: 'Main solid',
      axesGuides: 'Axes / guides',
      transparentSurface: 'Transparent surface',
      resetView: 'Reset View',
    },
    calculus: {
      svgAria: 'Calculus graph',
      kicker: 'Interactive Simulation / Calculus',
      title: 'Calculus Visualizer: Derivatives and Integrals',
      body: 'Drag the point to see tangent slope, and adjust the interval to see signed area.',
      derivative: 'Derivative / Tangent',
      integral: 'Integral / Signed Area',
      currentFunction: 'Current Function',
      tangentPoint: 'Tangent point x',
      integralLeft: 'Integral left endpoint',
      integralRight: 'Integral right endpoint',
      keyIdea: 'Key Idea',
      keyIdeaText: { derivative: 'Tangent slope represents instantaneous rate of change', integral: 'Signed area represents accumulated quantity' },
      resultBody: 'CSCA may not go deep into calculus, but this visual intuition helps interpret function trends.',
      functionCurve: 'Function curve',
      tangentLine: 'Tangent line',
      signedArea: 'Signed area',
    },
    set: {
      svgAria: 'Set operations Venn diagram',
      kicker: 'Interactive Simulation / Sets',
      title: 'Set Operations with Venn Diagrams',
      body: 'Switch set operations and watch highlighted regions match the resulting elements.',
      operation: 'Operation',
      currentResult: 'Current Result',
      deMorgan: "De Morgan's Laws",
      operations: {
        union: { name: 'Union', description: 'Keep elements that belong to A or B.' },
        intersection: { name: 'Intersection', description: 'Keep only elements shared by A and B.' },
        aMinusB: { name: 'Difference A\\B', description: 'Keep elements in A that are not in B.' },
        bMinusA: { name: 'Difference B\\A', description: 'Keep elements in B that are not in A.' },
        aComplement: { name: 'Complement of A', description: 'Keep all elements in U that are not in A.' },
        bComplement: { name: 'Complement of B', description: 'Keep all elements in U that are not in B.' },
        symmetricDifference: { name: 'Symmetric Difference', description: 'Keep elements in A or B, but not in both.' },
      },
      legendAria: 'Set Venn diagram legend',
      onlyA: 'Only in A',
      onlyB: 'Only in B',
      intersection: 'Intersection of A and B',
      outside: 'Region in U outside the current set',
      universalSet: 'Universal set',
      readVenn: 'How to Read the Venn Diagram',
      readVennBody: 'First separate the four regions: only A, only B, both, and neither. Then keep the regions required by the operation.',
      relatedBody: 'Set operations often appear with complements, subsets, and element counts. Use the sets and inequalities module to reinforce them.',
    },
  },
};

MATH_VISUALIZER_COPY.vi = {
  ...MATH_VISUALIZER_COPY.en!,
  common: {
    back: '← Quay lại mô phỏng',
    viewFormulas: 'Xem công thức',
    relatedPractice: 'Luyện tập liên quan',
    backToMathPractice: 'Quay lại luyện Toán',
  },
  elementary: {
    ...MATH_VISUALIZER_COPY.en!.elementary,
    graphAria: 'Đồ thị so sánh hàm sơ cấp',
    kicker: 'Mô phỏng tương tác / Hàm số',
    title: 'So sánh hàm sơ cấp',
    body: 'So sánh hàm bậc nhất, bậc hai, mũ, logarit và hàm lũy thừa trên cùng một mặt phẳng tọa độ.',
    showing: 'Đang hiển thị: ',
    selectFunction: 'Chọn hàm số',
    displayedFunctions: 'Hàm đang hiển thị',
    functions: {
      linear: { label: 'Hàm bậc nhất', description: 'Hệ số góc điều khiển hướng; hệ số tự do quyết định giao điểm với trục y.' },
      quadratic: { label: 'Hàm bậc hai', description: 'Đỉnh, chiều mở và độ rộng là các đặc điểm chính.' },
      exponential: { label: 'Hàm mũ', description: 'Khi cơ số lớn hơn 1, đồ thị tăng và tiến gần trục x.' },
      logarithmic: { label: 'Hàm logarit', description: 'Miền xác định là x > 0; đây là hàm ngược của hàm mũ.' },
      power: { label: 'Hàm lũy thừa', description: 'Số mũ p thay đổi tốc độ tăng và hình dạng đường cong.' },
    },
    baseAria: 'Cơ số a',
    slopeAria: 'Hệ số góc k',
    shiftAria: 'Tham số tịnh tiến',
    exponentAria: 'Số mũ p',
    observationOrder: 'Thứ tự quan sát',
    observationBody: 'Bắt đầu từ miền xác định: hàm logarit chỉ tồn tại với x > 0. Sau đó so tốc độ tăng: hàm mũ thường vượt hàm bậc nhất và bậc hai về sau.',
    legendAria: 'Chú giải hàm sơ cấp',
    cscaUse: 'Cách xuất hiện trong CSCA',
    cscaUseBody: 'CSCA thường kiểm tra đồ thị, miền xác định, tính đơn điệu và giao điểm. So sánh trực tiếp các đường cong giúp phán đoán xu hướng tăng dễ hơn.',
    relatedBody: 'Sau khi so sánh, quay lại mô-đun hàm số để luyện miền xác định, tính chất đồ thị và câu hỏi tham số.',
  },
  inequality: {
    ...MATH_VISUALIZER_COPY.en!.inequality,
    graphAria: 'Đồ thị hàm của bất đẳng thức',
    numberLineAria: 'Trục số biểu diễn tập nghiệm',
    kicker: 'Mô phỏng tương tác / Bất đẳng thức',
    title: 'Trực quan hóa tập nghiệm bất đẳng thức',
    body: 'Đưa bất đẳng thức đại số lên đồ thị và trục số để hiểu biên, đầu mút mở/đóng và ký hiệu khoảng.',
    type: 'Loại',
    linear: 'Bất đẳng thức bậc nhất',
    quadratic: 'Bất đẳng thức bậc hai',
    comparison: 'So sánh',
    linearA: 'Hệ số bậc nhất a',
    constantB: 'Hằng số b',
    quadraticP: 'Tham số bậc hai p',
    quadraticQ: 'Tham số bậc hai q',
    solutionSet: 'Tập nghiệm',
    allReals: 'Toàn bộ số thực R',
    emptySet: 'Tập rỗng ∅',
    or: 'hoặc',
    resultBody: 'Các vạch màu cam đánh dấu giá trị x thỏa bất đẳng thức. Đầu mút rỗng là không lấy; đầu mút đặc là có lấy.',
    legendAria: 'Chú giải bất đẳng thức',
    functionGraph: 'Đồ thị hàm số',
    satisfyingX: 'Giá trị x thỏa bất đẳng thức',
    endpointExcluded: 'Không lấy đầu mút',
    endpointIncluded: 'Lấy đầu mút',
    boundaries: 'Cách xét biên',
    boundariesBody: 'Tìm điểm biên khi có dấu bằng trước, rồi xem đồ thị nằm trên hay dưới trục x. Có dấu bằng thì đầu mút đặc, không có thì đầu mút rỗng.',
    relatedBody: 'Bất đẳng thức bậc nhất và bậc hai thường kết hợp đồ thị, khoảng và ký hiệu tập hợp. Quay lại luyện tập tập hợp và bất đẳng thức để củng cố.',
  },
  sequence: {
    ...MATH_VISUALIZER_COPY.en!.sequence,
    svgAria: 'Biểu đồ giá trị các số hạng',
    kicker: 'Mô phỏng tương tác / Dãy số',
    title: 'Trực quan hóa dãy số: cấp số cộng và cấp số nhân',
    body: 'Quan sát từng số hạng thay đổi và liên hệ tốc độ tăng với tổng n số hạng đầu.',
    arithmetic: 'Cấp số cộng',
    geometric: 'Cấp số nhân',
    firstTerm: 'Số hạng đầu',
    commonDifference: 'Công sai',
    commonRatio: 'Công bội',
    termCount: 'Số hạng n',
    partialSum: 'Tổng n số hạng đầu',
    resultBody: 'Cấp số cộng cộng thêm một lượng cố định; cấp số nhân nhân theo một tỉ lệ cố định.',
    positiveTerm: 'Số hạng dương',
    negativeTerm: 'Số hạng âm',
    termPosition: 'Vị trí số hạng n',
  },
  probability: {
    ...MATH_VISUALIZER_COPY.en!.probability,
    svgAria: 'Mô phỏng hội tụ xác suất',
    targetProbability: 'Xác suất lý thuyết',
    frequency: 'Tần suất',
    trials: 'Số lần thử',
    kicker: 'Mô phỏng tương tác / Xác suất',
    title: 'Mô phỏng xác suất',
    body: 'Dùng các lần thử lặp lại để thấy tần suất tiến gần xác suất lý thuyết nhưng vẫn dao động cục bộ.',
    currentFrequency: 'tần suất hiện tại',
    probabilityAria: 'Xác suất lý thuyết p',
    trialsAria: 'Số lần thử n',
    runAgain: 'Chạy lại',
    roundResult: 'Kết quả lượt này',
    hitsResult: (hits: number, trials: number) => `${hits} lần trúng / ${trials} lần thử`,
    resultBody: 'Khi số lần thử tăng, đường cong thường tiến gần đường xác suất lý thuyết hơn, dù dao động cục bộ vẫn còn.',
    cumulativeFrequency: 'Tần suất tích lũy',
    theoreticalProbability: 'Xác suất lý thuyết',
  },
  vector: {
    ...MATH_VISUALIZER_COPY.en!.vector,
    svgAria: 'Sơ đồ phép toán vectơ',
    kicker: 'Mô phỏng tương tác / Vectơ',
    title: 'Phép toán vectơ',
    body: 'Điều chỉnh thành phần của hai vectơ và quan sát phép cộng, tích vô hướng và góc thay đổi.',
    angle: 'góc',
    vectorAria: (key: string) => `Vectơ ${key}`,
    componentResult: 'Kết quả theo thành phần',
    resultBody: 'Tích vô hướng dương thường là góc nhọn; âm là góc tù; bằng 0 là hai vectơ vuông góc.',
    vectorA: 'Vectơ a',
    vectorB: 'Vectơ b',
    guides: 'Đường phụ hình bình hành',
  },
  conic: {
    ...MATH_VISUALIZER_COPY.en!.conic,
    svgAria: 'Đồ thị đường conic',
    kicker: 'Mô phỏng tương tác / Hình học giải tích',
    title: 'Khám phá đường conic',
    body: 'Chuyển giữa elip, parabol và hyperbol để thấy tham số thay đổi hình dạng và vị trí tiêu điểm.',
    modes: { ellipse: 'Elip', parabola: 'Parabol', hyperbola: 'Hyperbol' },
    semiAxisA: 'Bán trục a',
    semiAxisB: 'Bán trục b',
    focalParameter: 'Tham số tiêu p',
    observationFocus: 'Trọng tâm quan sát',
    focusText: { ellipse: 'Tiêu điểm nằm trên trục lớn', parabola: 'p điều khiển độ rộng miệng', hyperbola: 'Đường nét đứt là tiệm cận' },
    resultBody: 'Nhận dạng phương trình chuẩn trước, rồi quan sát tham số ảnh hưởng đến độ rộng, miệng mở và tiêu điểm.',
    curve: 'Đường cong',
    focus: 'Tiêu điểm',
    guide: 'Tiệm cận / đường phụ',
  },
  coordinate: {
    ...MATH_VISUALIZER_COPY.en!.coordinate,
    svgAria: 'Sơ đồ tọa độ 3D',
    kicker: 'Mô phỏng tương tác / Tọa độ',
    title: 'Hình học tọa độ 3D',
    body: 'Điều chỉnh điểm A và B để xem khoảng cách và tọa độ trung điểm cập nhật theo thời gian thực.',
    pointAria: (point: string, key: string) => `Điểm ${point} ${key}`,
    formula: 'Công thức',
    resultBody: 'Tọa độ trung điểm là trung bình của từng thành phần tọa độ.',
    pointA: 'Điểm A',
    pointB: 'Điểm B',
    segment: 'Đoạn AB',
  },
  solid: {
    ...MATH_VISUALIZER_COPY.en!.solid,
    kicker: 'Mô phỏng tương tác / Hình học không gian',
    title: 'Khám phá khối hình 3D',
    body: 'Chuyển giữa các khối thường gặp, chỉnh kích thước và quan sát thể tích, diện tích bề mặt cập nhật.',
    modes: { cube: 'Lập phương', cuboid: 'Hộp chữ nhật', cylinder: 'Trụ', cone: 'Nón', sphere: 'Cầu', prism: 'Lăng trụ tam giác' },
    labels: { length: 'Dài', width: 'Rộng', height: 'Cao', base: 'Đáy' },
    arias: { side: 'Độ dài cạnh', length: 'Chiều dài', width: 'Chiều rộng', height: 'Chiều cao', radius: 'Bán kính', base: 'Cạnh đáy', triangleHeight: 'Chiều cao tam giác', prismLength: 'Chiều dài lăng trụ' },
    result: 'Kết quả',
    volume: 'Thể tích',
    surfaceArea: 'Diện tích bề mặt',
    resultBody: 'Trong bài thi, nhận dạng khối trước rồi dùng công thức phù hợp. Khối ghép nên tách thành các khối cơ bản.',
    loadError: 'Chế độ xem 3D hiện không tải được. Hãy làm mới trang hoặc thử lại sau.',
    loading: 'Đang tải chế độ xem 3D...',
    mainSolid: 'Khối chính',
    axesGuides: 'Trục / đường phụ',
    transparentSurface: 'Bề mặt trong suốt',
    resetView: 'Đặt lại góc nhìn',
  },
  calculus: {
    ...MATH_VISUALIZER_COPY.en!.calculus,
    svgAria: 'Đồ thị giải tích',
    kicker: 'Mô phỏng tương tác / Giải tích',
    title: 'Trực quan hóa đạo hàm và tích phân',
    body: 'Kéo điểm để xem hệ số góc tiếp tuyến, chỉnh khoảng để xem diện tích có dấu.',
    derivative: 'Đạo hàm / tiếp tuyến',
    integral: 'Tích phân / diện tích có dấu',
    currentFunction: 'Hàm hiện tại',
    tangentPoint: 'Hoành độ tiếp điểm x',
    integralLeft: 'Cận trái tích phân',
    integralRight: 'Cận phải tích phân',
    keyIdea: 'Ý chính',
    keyIdeaText: { derivative: 'Hệ số góc tiếp tuyến biểu diễn tốc độ thay đổi tức thời', integral: 'Diện tích có dấu biểu diễn lượng tích lũy' },
    resultBody: 'CSCA có thể không đi sâu vào giải tích, nhưng trực giác đồ thị này giúp đọc xu hướng biến thiên của hàm.',
    functionCurve: 'Đường cong hàm số',
    tangentLine: 'Tiếp tuyến',
    signedArea: 'Diện tích có dấu',
  },
  set: {
    ...MATH_VISUALIZER_COPY.en!.set,
    svgAria: 'Sơ đồ Venn phép toán tập hợp',
    kicker: 'Mô phỏng tương tác / Tập hợp',
    title: 'Phép toán tập hợp với sơ đồ Venn',
    body: 'Chuyển phép toán tập hợp và quan sát vùng tô sáng khớp với các phần tử kết quả.',
    operation: 'Phép toán',
    currentResult: 'Kết quả hiện tại',
    deMorgan: 'Định luật De Morgan',
    operations: {
      union: { name: 'Hợp', description: 'Giữ các phần tử thuộc A hoặc B.' },
      intersection: { name: 'Giao', description: 'Chỉ giữ phần tử chung của A và B.' },
      aMinusB: { name: 'Hiệu A\\B', description: 'Giữ phần tử thuộc A nhưng không thuộc B.' },
      bMinusA: { name: 'Hiệu B\\A', description: 'Giữ phần tử thuộc B nhưng không thuộc A.' },
      aComplement: { name: 'Phần bù của A', description: 'Giữ mọi phần tử trong U không thuộc A.' },
      bComplement: { name: 'Phần bù của B', description: 'Giữ mọi phần tử trong U không thuộc B.' },
      symmetricDifference: { name: 'Hiệu đối xứng', description: 'Giữ phần tử thuộc A hoặc B, nhưng không thuộc cả hai.' },
    },
    legendAria: 'Chú giải sơ đồ Venn',
    onlyA: 'Chỉ thuộc A',
    onlyB: 'Chỉ thuộc B',
    intersection: 'Giao của A và B',
    outside: 'Vùng trong U ngoài tập hiện tại',
    universalSet: 'Tập vũ trụ',
    readVenn: 'Cách đọc sơ đồ Venn',
    readVennBody: 'Trước tiên tách bốn vùng: chỉ A, chỉ B, cả hai và không thuộc tập nào. Sau đó giữ vùng mà phép toán yêu cầu.',
    relatedBody: 'Phép toán tập hợp thường đi cùng phần bù, tập con và số phần tử. Hãy dùng mô-đun tập hợp và bất đẳng thức để củng cố.',
  },
};

const functionBaseOptions: Array<{ key: FunctionBaseKey; label: string; expression: string }> = [
  { key: 'square', label: 'x²', expression: 'x²' },
  { key: 'sin', label: 'sin(x)', expression: 'sin(x)' },
  { key: 'abs', label: '|x|', expression: '|x|' },
  { key: 'sqrt', label: '√x', expression: '√x' }
];

const setOperationOptions: Array<{ key: SetOperationKey; label: string; name: string; description: string }> = [
  { key: 'union', label: 'A ∪ B', name: '并集', description: '属于 A 或属于 B 的元素都会被保留。' },
  { key: 'intersection', label: 'A ∩ B', name: '交集', description: '只保留同时属于 A 和 B 的公共元素。' },
  { key: 'aMinusB', label: 'A \\ B', name: '差集 A\\B', description: '保留属于 A 但不属于 B 的元素。' },
  { key: 'bMinusA', label: 'B \\ A', name: '差集 B\\A', description: '保留属于 B 但不属于 A 的元素。' },
  { key: 'aComplement', label: 'Aᶜ', name: 'A 的补集', description: '在全集 U 中，所有不属于 A 的元素。' },
  { key: 'bComplement', label: 'Bᶜ', name: 'B 的补集', description: '在全集 U 中，所有不属于 B 的元素。' },
  { key: 'symmetricDifference', label: 'A △ B', name: '对称差', description: '保留只属于 A 或只属于 B，但不同时属于两者的元素。' }
];

const elementaryFunctionOptions: Array<{ key: ElementaryFunctionKey; label: string; expression: string; description: string; colorClass: string }> = [
  { key: 'linear', label: '一次函数', expression: 'y=kx+b', description: '斜率决定方向，截距决定与 y 轴交点。', colorClass: 'linear' },
  { key: 'quadratic', label: '二次函数', expression: 'y=a(x-h)²+k', description: '顶点、开口方向和宽窄是观察重点。', colorClass: 'quadratic' },
  { key: 'exponential', label: '指数函数', expression: 'y=aˣ', description: '底数大于 1 时递增，靠近 x 轴但不相交。', colorClass: 'exponential' },
  { key: 'logarithmic', label: '对数函数', expression: 'y=logₐx', description: '定义域为 x>0，是指数函数的反函数。', colorClass: 'logarithmic' },
  { key: 'power', label: '幂函数', expression: 'y=xᵖ', description: '指数 p 改变增长速度和曲线形状。', colorClass: 'power' }
];

const comparatorOptions: Array<{ value: InequalityComparator; label: string }> = [
  { value: '>', label: '> 0' },
  { value: '>=', label: '≥ 0' },
  { value: '<', label: '< 0' },
  { value: '<=', label: '≤ 0' }
];

function evaluateBaseFunction(base: FunctionBaseKey, input: number) {
  if (base === 'square') return input * input;
  if (base === 'sin') return Math.sin(input);
  if (base === 'abs') return Math.abs(input);
  if (base === 'sqrt') return input < 0 ? null : Math.sqrt(input);
  return input;
}

function formatSigned(value: number) {
  if (Math.abs(value) < 0.001) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildFunctionPath(base: FunctionBaseKey, params: { a: number; b: number; c: number; d: number }) {
  const width = 640;
  const height = 420;
  const xMin = -8;
  const xMax = 8;
  const yMin = -6;
  const yMax = 6;
  const steps = 420;
  const parts: string[] = [];
  let open = false;

  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const x = xMin + (xMax - xMin) * ratio;
    const inner = params.b * x + params.c;
    const baseValue = evaluateBaseFunction(base, inner);
    if (baseValue === null) {
      open = false;
      continue;
    }
    const y = params.a * baseValue + params.d;
    if (!Number.isFinite(y) || y < yMin || y > yMax) {
      open = false;
      continue;
    }
    const sx = ((x - xMin) / (xMax - xMin)) * width;
    const sy = height - ((y - yMin) / (yMax - yMin)) * height;
    parts.push(`${open ? 'L' : 'M'} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
    open = true;
  }

  return parts.join(' ');
}

function transformedFormula(base: FunctionBaseKey, params: { a: number; b: number; c: number; d: number }) {
  const baseLabel = functionBaseOptions.find((item) => item.key === base)?.expression ?? 'f(x)';
  return `y = ${formatSigned(params.a)}·f(${formatSigned(params.b)}x ${params.c >= 0 ? '+' : '-'} ${formatSigned(Math.abs(params.c))}) ${params.d >= 0 ? '+' : '-'} ${formatSigned(Math.abs(params.d))},  f(x)=${baseLabel}`;
}

function getSetOperationResult(operation: SetOperationKey) {
  const universe = [1, 2, 3, 4, 5, 6, 7, 8];
  const setA = new Set([1, 2, 4, 5]);
  const setB = new Set([2, 3, 5, 7]);
  return universe.filter((value) => {
    const inA = setA.has(value);
    const inB = setB.has(value);
    if (operation === 'union') return inA || inB;
    if (operation === 'intersection') return inA && inB;
    if (operation === 'aMinusB') return inA && !inB;
    if (operation === 'bMinusA') return inB && !inA;
    if (operation === 'aComplement') return !inA;
    if (operation === 'bComplement') return !inB;
    return inA !== inB;
  });
}

function evaluateElementaryFunction(type: ElementaryFunctionKey, x: number, params: { base: number; slope: number; intercept: number; exponent: number }) {
  if (type === 'linear') return params.slope * x + params.intercept;
  if (type === 'quadratic') return 0.28 * params.slope * (x - params.intercept) ** 2 - 2;
  if (type === 'exponential') return Math.pow(params.base, x);
  if (type === 'logarithmic') return x <= 0 ? null : Math.log(x) / Math.log(params.base);
  if (type === 'power') return x < 0 && Math.abs(params.exponent % 1) > 0.001 ? null : Math.sign(x) * Math.pow(Math.abs(x), params.exponent);
  return null;
}

function buildCartesianPath(
  fn: (x: number) => number | null,
  config: { width?: number; height?: number; xMin?: number; xMax?: number; yMin?: number; yMax?: number; steps?: number } = {}
) {
  const width = config.width ?? 640;
  const height = config.height ?? 420;
  const xMin = config.xMin ?? -8;
  const xMax = config.xMax ?? 8;
  const yMin = config.yMin ?? -6;
  const yMax = config.yMax ?? 6;
  const steps = config.steps ?? 420;
  const parts: string[] = [];
  let open = false;

  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const x = xMin + (xMax - xMin) * ratio;
    const y = fn(x);
    if (y === null || !Number.isFinite(y) || y < yMin || y > yMax) {
      open = false;
      continue;
    }
    const sx = ((x - xMin) / (xMax - xMin)) * width;
    const sy = height - ((y - yMin) / (yMax - yMin)) * height;
    parts.push(`${open ? 'L' : 'M'} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
    open = true;
  }

  return parts.join(' ');
}

function compareWith(value: number, comparator: InequalityComparator) {
  const epsilon = 0.0001;
  if (comparator === '>') return value > epsilon;
  if (comparator === '>=') return value >= -epsilon;
  if (comparator === '<') return value < -epsilon;
  return value <= epsilon;
}

function formatIntervalValue(value: number) {
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : '-∞';
  if (Math.abs(value) < 0.001) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function comparatorSymbol(comparator: InequalityComparator) {
  if (comparator === '>=') return '≥';
  if (comparator === '<=') return '≤';
  return comparator;
}

function solveLinearInequality(a: number, b: number, comparator: InequalityComparator) {
  const symbol = comparatorSymbol(comparator);
  if (Math.abs(a) < 0.001) {
    const all = compareWith(b, comparator);
    return {
      expression: `${formatSigned(a)}x ${b >= 0 ? '+' : '-'} ${formatSigned(Math.abs(b))} ${symbol} 0`,
      text: all ? '全体实数 R' : '空集 ∅',
      intervals: all ? [{ start: -Infinity, end: Infinity, leftClosed: false, rightClosed: false }] : []
    };
  }
  const boundary = -b / a;
  const testRight = compareWith(a * (boundary + 1) + b, comparator);
  const includeBoundary = comparator.includes('=');
  const interval = testRight
    ? { start: boundary, end: Infinity, leftClosed: includeBoundary, rightClosed: false }
    : { start: -Infinity, end: boundary, leftClosed: false, rightClosed: includeBoundary };
  const sign = b >= 0 ? '+' : '-';
  return {
    expression: `${formatSigned(a)}x ${sign} ${formatSigned(Math.abs(b))} ${symbol} 0`,
    text: testRight
      ? `x ${includeBoundary ? '≥' : '>'} ${formatIntervalValue(boundary)}`
      : `x ${includeBoundary ? '≤' : '<'} ${formatIntervalValue(boundary)}`,
    intervals: [interval]
  };
}

function solveQuadraticInequality(p: number, q: number, comparator: InequalityComparator) {
  const discriminant = p * p - 4 * q;
  const includeBoundary = comparator.includes('=');
  const expression = `x² ${p >= 0 ? '+' : '-'} ${formatSigned(Math.abs(p))}x ${q >= 0 ? '+' : '-'} ${formatSigned(Math.abs(q))} ${comparatorSymbol(comparator)} 0`;
  if (discriminant < -0.001) {
    const all = comparator === '>' || comparator === '>=';
    return {
      expression,
      text: all ? '全体实数 R' : '空集 ∅',
      intervals: all ? [{ start: -Infinity, end: Infinity, leftClosed: false, rightClosed: false }] : [],
      roots: []
    };
  }
  if (Math.abs(discriminant) <= 0.001) {
    const root = -p / 2;
    const allExceptRoot = comparator === '>';
    const all = comparator === '>=';
    const onlyRoot = comparator === '<=';
    return {
      expression,
      text: all ? '全体实数 R' : allExceptRoot ? `x ≠ ${formatIntervalValue(root)}` : onlyRoot ? `x = ${formatIntervalValue(root)}` : '空集 ∅',
      intervals: all
        ? [{ start: -Infinity, end: Infinity, leftClosed: false, rightClosed: false }]
        : allExceptRoot
          ? [
              { start: -Infinity, end: root, leftClosed: false, rightClosed: false },
              { start: root, end: Infinity, leftClosed: false, rightClosed: false }
            ]
          : onlyRoot
            ? [{ start: root, end: root, leftClosed: true, rightClosed: true }]
            : [],
      roots: [root]
    };
  }
  const sqrtD = Math.sqrt(discriminant);
  const r1 = (-p - sqrtD) / 2;
  const r2 = (-p + sqrtD) / 2;
  const outside = comparator === '>' || comparator === '>=';
  return {
    expression,
    text: outside
      ? `x ${includeBoundary ? '≤' : '<'} ${formatIntervalValue(r1)} 或 x ${includeBoundary ? '≥' : '>'} ${formatIntervalValue(r2)}`
      : `${formatIntervalValue(r1)} ${includeBoundary ? '≤' : '<'} x ${includeBoundary ? '≤' : '<'} ${formatIntervalValue(r2)}`,
    intervals: outside
      ? [
          { start: -Infinity, end: r1, leftClosed: false, rightClosed: includeBoundary },
          { start: r2, end: Infinity, leftClosed: includeBoundary, rightClosed: false }
        ]
      : [{ start: r1, end: r2, leftClosed: includeBoundary, rightClosed: includeBoundary }],
    roots: [r1, r2]
  };
}

function sequenceValues(mode: SequenceMode, params: { first: number; diff: number; ratio: number; count: number }) {
  return Array.from({ length: params.count }, (_, index) => {
    const n = index + 1;
    return mode === 'arithmetic' ? params.first + index * params.diff : params.first * Math.pow(params.ratio, index);
  });
}

function formatNumber(value: number) {
  if (Math.abs(value) < 0.001) return '0';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function localizeInequalityText(value: string, copy: Record<string, any>) {
  return value
    .replace(/全体实数 R/g, copy.allReals)
    .replace(/空集 ∅/g, copy.emptySet)
    .replace(/ 或 /g, ` ${copy.or} `);
}

function seededUniform(index: number, seed: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function project3d(point: { x: number; y: number; z: number }) {
  const origin = { x: 320, y: 220 };
  return {
    x: origin.x + point.x * 34 + point.y * 18,
    y: origin.y - point.z * 34 + point.y * 14
  };
}

function evaluateCalculusFunction(x: number) {
  return 0.22 * x * x - 1.1;
}

function calculusDerivative(x: number) {
  return 0.44 * x;
}

function calculusAntiderivative(x: number) {
  return (0.22 / 3) * x * x * x - 1.1 * x;
}
function UnitCircleSvg({ angleDeg, showSin, showCos, showTan, tanValue, tanUndefined, copy }: { angleDeg: number; showSin: boolean; showCos: boolean; showTan: boolean; tanValue: number | null; tanUndefined: boolean; copy: Pick<TrigCopy, 'unitCircleAria'> }) {
  const center = 210;
  const radius = 142;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const px = center + cos * radius;
  const py = center - sin * radius;
  const fx = center + cos * radius;
  const fy = center;
  const tanX = center + radius;
  const tanY = tanValue === null ? center : center - clamp(tanValue, -1.85, 1.85) * radius;
  const largeArc = angleDeg % 360 > 180 ? 1 : 0;
  const arcEndX = center + Math.cos(rad) * 42;
  const arcEndY = center - Math.sin(rad) * 42;
  const arcPath = `M ${center + 42} ${center} A 42 42 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`;

  return (
    <svg className="special-unit-circle" viewBox="0 0 420 420" role="img" aria-label={copy.unitCircleAria}>
      <defs>
        <pattern id="unit-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(99,114,138,.08)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="420" height="420" fill="url(#unit-grid)" />
      <line x1="28" y1={center} x2="392" y2={center} className="axis" />
      <line x1={center} y1="28" x2={center} y2="392" className="axis" />
      <circle cx={center} cy={center} r={radius} className="circle" />
      <path d={arcPath} className="angle-arc" />
      <text x={arcEndX + 10} y={arcEndY + 8} className="angle-label">{angleDeg}°</text>
      <line x1={center} y1={center} x2={px} y2={py} className="terminal" />
      {showCos && <line x1={center} y1={center} x2={fx} y2={fy} className="cos-line" />}
      {showSin && <line x1={fx} y1={fy} x2={px} y2={py} className="sin-line" />}
      {showTan && (
        <>
          <line x1={tanX} y1="52" x2={tanX} y2="368" className="tan-axis" />
          {!tanUndefined && (
            <>
              <line x1={center} y1={center} x2={tanX} y2={tanY} className="tan-ray" />
              <line x1={tanX} y1={center} x2={tanX} y2={tanY} className="tan-line" />
              <circle cx={tanX} cy={tanY} r="5" className="tan-dot" />
            </>
          )}
        </>
      )}
      <circle cx={px} cy={py} r="7" className="point" />
      {showSin && <text x={fx + 8} y={(fy + py) / 2} className="sin-text">sin</text>}
      {showCos && <text x={(center + fx) / 2 - 8} y={center + 18} className="cos-text">cos</text>}
      {showTan && !tanUndefined && <text x={tanX + 8} y={(center + tanY) / 2} className="tan-text">tan</text>}
      <text x={center + radius + 4} y={center + 18} className="axis-label">1</text>
      <text x={center + 4} y={center - radius - 8} className="axis-label">1</text>
    </svg>
  );
}

function TrigGraphSvg({ angleDeg, showSin, showCos, showTan, tanUndefined, copy }: { angleDeg: number; showSin: boolean; showCos: boolean; showTan: boolean; tanUndefined: boolean; copy: Pick<TrigCopy, 'graphAria'> }) {
  const width = 520;
  const height = 360;
  const rad = (angleDeg * Math.PI) / 180;
  const x = (rad / (Math.PI * 2)) * width;
  const yLimit = 1.25;
  const y = (value: number) => height / 2 - (value / yLimit) * (height * 0.42);
  const sinValue = Math.sin(rad);
  const cosValue = Math.cos(rad);
  const tanValue = tanUndefined ? null : Math.tan(rad);
  const sinPath = buildWavePath((next) => Math.sin(next), width, height, yLimit);
  const cosPath = buildWavePath((next) => Math.cos(next), width, height, yLimit);
  const tanPath = buildWavePath((next) => {
    const value = Math.tan(next);
    return Math.abs(Math.cos(next)) < 0.05 ? null : value;
  }, width, height, 2.2);

  return (
    <svg className="special-trig-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.graphAria}>
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="axis" />
      <line x1="0" y1="24" x2="0" y2={height - 24} className="axis" />
      {[Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2].map((mark) => (
        <g key={mark}>
          <line x1={(mark / (Math.PI * 2)) * width} y1={height / 2 - 5} x2={(mark / (Math.PI * 2)) * width} y2={height / 2 + 5} className="tick" />
          <text x={(mark / (Math.PI * 2)) * width - 8} y={height / 2 + 24} className="axis-label">{mark === Math.PI / 2 ? 'π/2' : mark === Math.PI ? 'π' : mark === Math.PI * 1.5 ? '3π/2' : '2π'}</text>
        </g>
      ))}
      {showTan && [Math.PI / 2, Math.PI * 1.5].map((mark) => <line key={mark} x1={(mark / (Math.PI * 2)) * width} y1="28" x2={(mark / (Math.PI * 2)) * width} y2={height - 28} className="tan-asymptote" />)}
      {showSin && <path d={sinPath} className="sin-curve" />}
      {showCos && <path d={cosPath} className="cos-curve" />}
      {showTan && <path d={tanPath} className="tan-curve" />}
      <line x1={x} y1="28" x2={x} y2={height - 28} className="angle-marker" />
      {showSin && <circle cx={x} cy={y(sinValue)} r="5" className="sin-dot" />}
      {showCos && <circle cx={x} cy={y(cosValue)} r="5" className="cos-dot" />}
      {showTan && tanValue !== null && Math.abs(tanValue) <= 2.2 && <circle cx={x} cy={height / 2 - (tanValue / 2.2) * (height * 0.42)} r="5" className="tan-dot" />}
    </svg>
  );
}

export function TrigVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(TRIG_COPY, locale);
  const [angleDeg, setAngleDeg] = useState(45);
  const [visible, setVisible] = useState({ sin: true, cos: true, tan: false });
  const rad = (angleDeg * Math.PI) / 180;
  const sinValue = Math.sin(rad);
  const cosValue = Math.cos(rad);
  const tanUndefined = Math.abs(cosValue) < 0.0001;
  const tanValue = tanUndefined ? null : Math.tan(rad);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('math'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('trigonometry'))}>{copy.viewFormulas}</button>
      </section>

      <section className="special-visualizer-card">
        <div className="special-trig-value-card" data-testid="trig-values">
          {visible.sin && <span className="sin">sin({angleDeg}°) = <b>{formatTrigValue(sinValue, copy)}</b></span>}
          {visible.cos && <span className="cos">cos({angleDeg}°) = <b>{formatTrigValue(cosValue, copy)}</b></span>}
          {visible.tan && <span className="tan">tan({angleDeg}°) = <b>{formatTrigValue(tanValue, copy)}</b></span>}
        </div>
        <div className="special-visualizer-stage">
          <UnitCircleSvg angleDeg={angleDeg} showSin={visible.sin} showCos={visible.cos} showTan={visible.tan} tanValue={tanValue} tanUndefined={tanUndefined} copy={copy} />
          <TrigGraphSvg angleDeg={angleDeg} showSin={visible.sin} showCos={visible.cos} showTan={visible.tan} tanUndefined={tanUndefined} copy={copy} />
        </div>
        <div className="special-visual-legend" aria-label={copy.legendAria}>
          <span><i className="dash" />{copy.dashedLegend}</span>
          <span><i className="solid blue" />{copy.sinLegend}</span>
          <span><i className="solid red" />{copy.cosLegend}</span>
          {visible.tan && <span><i className="solid amber" />{copy.tanLegend}</span>}
        </div>
        <div className="special-visualizer-controls">
          <label>
            <span>{copy.angle}</span>
            <strong>{angleDeg}°</strong>
            <input aria-label={copy.angleAria} type="range" min="0" max="360" step="1" value={angleDeg} onChange={(event) => setAngleDeg(Number(event.target.value))} />
          </label>
          <div className="special-trig-switches">
            {(['sin', 'cos', 'tan'] as const).map((key) => (
              <label key={key} className={key}>
                <input
                  type="checkbox"
                  checked={visible[key]}
                  onChange={(event) => setVisible((current) => ({ ...current, [key]: event.target.checked }))}
                />
                <span>{key}</span>
              </label>
            ))}
          </div>
          {visible.tan && tanUndefined && <p className="special-tan-warning">{copy.tanUndefinedWarning}</p>}
          {visible.tan && tanValue !== null && Math.abs(tanValue) >= 10 && <p className="special-tan-warning">{copy.tanOutOfRangeWarning}</p>}
        </div>
      </section>

      <section className="special-visualizer-support">
        <article>
          <h2>{copy.coreFormula}</h2>
          <p>{copy.coreFormulaBody}</p>
          <GhostButton onClick={() => onNavigate(formulaPath('trigonometry'))}>{copy.viewTrigFormulas}</GhostButton>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <button type="button" onClick={() => onNavigate(subjectPath('math'))}>{copy.backToMathPractice}</button>
        </article>
      </section>
    </div>
  );
}


function FunctionGraphSvg({ base, params, showOriginal, copy }: { base: FunctionBaseKey; params: { a: number; b: number; c: number; d: number }; showOriginal: boolean; copy: Pick<FunctionTransformCopy, 'graphAria'> }) {
  const width = 640;
  const height = 420;
  const path = buildFunctionPath(base, params);
  const originalPath = buildFunctionPath(base, { a: 1, b: 1, c: 0, d: 0 });
  const xAxis = height / 2;
  const yAxis = width / 2;

  return (
    <svg className="special-function-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.graphAria}>
      <defs>
        <pattern id="function-grid" width="40" height="35" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 35" fill="none" stroke="rgba(99,114,138,.08)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#function-grid)" />
      <line x1="0" y1={xAxis} x2={width} y2={xAxis} className="axis" />
      <line x1={yAxis} y1="0" x2={yAxis} y2={height} className="axis" />
      {[-6, -4, -2, 2, 4, 6].map((value) => (
        <g key={`x-${value}`}>
          <line x1={yAxis + value * 40} y1={xAxis - 5} x2={yAxis + value * 40} y2={xAxis + 5} className="tick" />
          <text x={yAxis + value * 40 - 7} y={xAxis + 22} className="axis-label">{value}</text>
        </g>
      ))}
      {[-4, -2, 2, 4, 6].map((value) => (
        <g key={`y-${value}`}>
          <line x1={yAxis - 5} y1={xAxis - value * 35} x2={yAxis + 5} y2={xAxis - value * 35} className="tick" />
          <text x={yAxis + 10} y={xAxis - value * 35 + 5} className="axis-label">{value}</text>
        </g>
      ))}
      <text x={width - 18} y={xAxis - 10} className="axis-label">x</text>
      <text x={yAxis + 10} y="18" className="axis-label">y</text>
      {showOriginal && <path data-testid="function-original-curve" d={originalPath} className="function-original-curve" />}
      <path data-testid="function-curve" d={path} className="function-curve" />
    </svg>
  );
}

export function FunctionTransformVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(FUNCTION_TRANSFORM_COPY, locale);
  const [base, setBase] = useState<FunctionBaseKey>('square');
  const [params, setParams] = useState({ a: 1, b: 1, c: 0, d: 0 });
  const [showOriginal, setShowOriginal] = useState(true);
  const setParam = (key: keyof typeof params, value: number) => setParams((current) => ({ ...current, [key]: value }));
  const baseLabel = functionBaseOptions.find((item) => item.key === base)?.expression ?? 'f(x)';

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('functions'))}>{copy.viewFormulas}</button>
      </section>

      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div className="special-current-formula" data-testid="function-formula">{transformedFormula(base, params)}</div>
            <div className="special-visual-note">
              <span>{copy.originalFunction}</span>
              <strong>y = {baseLabel}</strong>
              <p>{copy.visualNote}</p>
            </div>
            <div>
              <h2>{copy.baseFunction}</h2>
              <div className="special-button-grid">
                {functionBaseOptions.map((item) => (
                  <button key={item.key} type="button" className={base === item.key ? 'active' : ''} onClick={() => setBase(item.key)}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="special-slider-stack">
              {(['a', 'b', 'c', 'd'] as const).map((key) => (
                <label key={key}>
                  <span>{key}</span>
                  <input aria-label={copy.parameterAria(key)} type="range" min={key === 'a' || key === 'b' ? -2 : -4} max={key === 'a' || key === 'b' ? 2 : 4} step="0.1" value={params[key]} onChange={(event) => setParam(key, Number(event.target.value))} />
                  <strong>{formatSigned(params[key])}</strong>
                </label>
              ))}
            </div>
            <label className="special-inline-switch">
              <input type="checkbox" checked={showOriginal} onChange={(event) => setShowOriginal(event.target.checked)} />
              <span>{copy.showOriginal}</span>
            </label>
            <GhostButton onClick={() => setParams({ a: 1, b: 1, c: 0, d: 0 })}>{copy.reset}</GhostButton>
            <div className="special-reference-note">
              <strong>{copy.quickReference}</strong>
              <p>{copy.quickReferenceBody}</p>
            </div>
          </aside>
          <div className="special-graph-panel">
            <FunctionGraphSvg base={base} params={params} showOriginal={showOriginal} copy={copy} />
            <div className="special-visual-legend" aria-label={copy.legendAria}>
              <span><i className="dash" />{copy.baseLegend}</span>
              <span><i className="solid blue" />{copy.transformedLegend}</span>
              <span><i className="axis" />{copy.axesLegend}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support">
        <article>
          <h2>{copy.howToRead}</h2>
          <p>{copy.howToReadBody}</p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <button type="button" onClick={() => onNavigate(subjectPath('math'))}>{copy.backToMathPractice}</button>
        </article>
      </section>
    </div>
  );
}

function ElementaryFunctionsSvg({ selected, params, copy }: { selected: ElementaryFunctionKey[]; params: { base: number; slope: number; intercept: number; exponent: number }; copy: Record<string, any> }) {
  const width = 640;
  const height = 420;
  const xAxis = height / 2;
  const yAxis = width / 2;

  return (
    <svg className="special-function-graph special-comparison-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.graphAria}>
      <defs>
        <pattern id="elementary-grid" width="40" height="35" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 35" fill="none" stroke="rgba(99,114,138,.08)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#elementary-grid)" />
      <line x1="0" y1={xAxis} x2={width} y2={xAxis} className="axis" />
      <line x1={yAxis} y1="0" x2={yAxis} y2={height} className="axis" />
      {[-6, -4, -2, 2, 4, 6].map((value) => (
        <g key={`elementary-x-${value}`}>
          <line x1={yAxis + value * 40} y1={xAxis - 5} x2={yAxis + value * 40} y2={xAxis + 5} className="tick" />
          <text x={yAxis + value * 40 - 7} y={xAxis + 22} className="axis-label">{value}</text>
        </g>
      ))}
      {[-4, -2, 2, 4, 6].map((value) => (
        <g key={`elementary-y-${value}`}>
          <line x1={yAxis - 5} y1={xAxis - value * 35} x2={yAxis + 5} y2={xAxis - value * 35} className="tick" />
          <text x={yAxis + 10} y={xAxis - value * 35 + 5} className="axis-label">{value}</text>
        </g>
      ))}
      <text x={width - 18} y={xAxis - 10} className="axis-label">x</text>
      <text x={yAxis + 10} y="18" className="axis-label">y</text>
      {selected.map((type) => {
        const option = elementaryFunctionOptions.find((item) => item.key === type);
        return (
          <path
            key={type}
            data-testid={`elementary-curve-${type}`}
            d={buildCartesianPath((x) => evaluateElementaryFunction(type, x, params))}
            className={`elementary-curve ${option?.colorClass ?? type}`}
          />
        );
      })}
    </svg>
  );
}

export function ElementaryFunctionsVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.elementary;
  const common = allCopy.common;
  const [selected, setSelected] = useState<ElementaryFunctionKey[]>(['linear', 'quadratic', 'exponential']);
  const [params, setParams] = useState({ base: 2, slope: 1, intercept: 0, exponent: 2 });
  const toggle = (key: ElementaryFunctionKey) => {
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  const setParam = (key: keyof typeof params, value: number) => setParams((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('functions'))}>{common.viewFormulas}</button>
      </section>

      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div className="special-current-formula" data-testid="elementary-summary">
              {copy.showing}{selected.map((key) => elementaryFunctionOptions.find((item) => item.key === key)?.expression).filter(Boolean).join(' / ') || copy.selectFunction}
            </div>
            <div>
              <h2>{copy.displayedFunctions}</h2>
              <div className="special-check-grid">
                {elementaryFunctionOptions.map((item) => (
                  <label key={item.key} className={selected.includes(item.key) ? 'active' : ''}>
                    <input type="checkbox" checked={selected.includes(item.key)} onChange={() => toggle(item.key)} />
                    <span>{copy.functions[item.key].label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="special-slider-stack">
              <label>
                <span>a</span>
                <input aria-label={copy.baseAria} type="range" min="1.2" max="4" step="0.1" value={params.base} onChange={(event) => setParam('base', Number(event.target.value))} />
                <strong>{params.base.toFixed(1)}</strong>
              </label>
              <label>
                <span>k</span>
                <input aria-label={copy.slopeAria} type="range" min="-3" max="3" step="0.1" value={params.slope} onChange={(event) => setParam('slope', Number(event.target.value))} />
                <strong>{formatSigned(params.slope)}</strong>
              </label>
              <label>
                <span>b/h</span>
                <input aria-label={copy.shiftAria} type="range" min="-3" max="3" step="0.1" value={params.intercept} onChange={(event) => setParam('intercept', Number(event.target.value))} />
                <strong>{formatSigned(params.intercept)}</strong>
              </label>
              <label>
                <span>p</span>
                <input aria-label={copy.exponentAria} type="range" min="0.5" max="4" step="0.5" value={params.exponent} onChange={(event) => setParam('exponent', Number(event.target.value))} />
                <strong>{params.exponent.toFixed(1)}</strong>
              </label>
            </div>
            <div className="special-reference-note">
              <strong>{copy.observationOrder}</strong>
              <p>{copy.observationBody}</p>
            </div>
          </aside>
          <div className="special-graph-panel">
            <ElementaryFunctionsSvg selected={selected} params={params} copy={copy} />
            <div className="special-visual-legend" aria-label={copy.legendAria}>
              {elementaryFunctionOptions.map((item) => selected.includes(item.key) && (
                <span key={item.key}><i className={`solid ${item.colorClass}`} />{item.expression}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support">
        <article>
          <h2>{copy.cscaUse}</h2>
          <p>{copy.cscaUseBody}</p>
        </article>
        <article>
          <h2>{common.relatedPractice}</h2>
          <p>{copy.relatedBody}</p>
          <button type="button" onClick={() => onNavigate(subjectPath('math'))}>{common.backToMathPractice}</button>
        </article>
      </section>
    </div>
  );
}

function InequalityGraphSvg({ mode, comparator, linear, quadratic, copy }: { mode: InequalityMode; comparator: InequalityComparator; linear: { a: number; b: number }; quadratic: { p: number; q: number }; copy: Record<string, any> }) {
  const width = 640;
  const height = 360;
  const xAxis = height / 2;
  const yAxis = width / 2;
  const fn = mode === 'linear'
    ? (x: number) => linear.a * x + linear.b
    : (x: number) => x * x + quadratic.p * x + quadratic.q;
  const path = buildCartesianPath(fn, { width, height, yMin: -5, yMax: 5 });

  return (
    <svg className="special-function-graph special-inequality-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.graphAria}>
      <defs>
        <pattern id="inequality-grid" width="40" height="30" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(99,114,138,.08)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#inequality-grid)" />
      <line x1="0" y1={xAxis} x2={width} y2={xAxis} className="axis" />
      <line x1={yAxis} y1="0" x2={yAxis} y2={height} className="axis" />
      <path data-testid="inequality-curve" d={path} className="function-curve" />
      {Array.from({ length: 161 }, (_, index) => -8 + index * 0.1).map((x) => compareWith(fn(x), comparator) ? x : null).filter((x): x is number => x !== null).map((x) => {
        const sx = ((x + 8) / 16) * width;
        return <line key={`solution-${x.toFixed(1)}`} x1={sx} y1={xAxis + 2} x2={sx} y2={xAxis + 12} className="solution-tick" />;
      })}
      <text x={width - 18} y={xAxis - 10} className="axis-label">x</text>
      <text x={yAxis + 10} y="18" className="axis-label">y</text>
    </svg>
  );
}

function NumberLineSvg({ intervals, copy }: { intervals: Array<{ start: number; end: number; leftClosed: boolean; rightClosed: boolean }>; copy: Record<string, any> }) {
  const width = 640;
  const xMin = -8;
  const xMax = 8;
  const mapX = (value: number) => {
    if (value === -Infinity) return 34;
    if (value === Infinity) return width - 34;
    return 34 + ((Math.max(xMin, Math.min(xMax, value)) - xMin) / (xMax - xMin)) * (width - 68);
  };

  return (
    <svg className="special-number-line" viewBox={`0 0 ${width} 104`} role="img" aria-label={copy.numberLineAria}>
      <line x1="34" y1="52" x2={width - 34} y2="52" className="axis" />
      <path d={`M ${width - 42} 45 L ${width - 34} 52 L ${width - 42} 59`} className="arrow" />
      {[-6, -4, -2, 0, 2, 4, 6].map((value) => (
        <g key={`number-${value}`}>
          <line x1={mapX(value)} y1="46" x2={mapX(value)} y2="58" className="tick" />
          <text x={mapX(value)} y="78" className="axis-label">{value}</text>
        </g>
      ))}
      {intervals.map((interval, index) => {
        const startX = mapX(interval.start);
        const endX = mapX(interval.end);
        const isPoint = Math.abs(startX - endX) < 1;
        return (
          <g key={`${interval.start}-${interval.end}-${index}`}>
            <line x1={startX} y1="52" x2={endX} y2="52" className="solution-line" />
            {isPoint ? (
              <circle cx={startX} cy="52" r="7" className="endpoint closed" />
            ) : (
              <>
                {Number.isFinite(interval.start) && <circle cx={startX} cy="52" r="7" className={interval.leftClosed ? 'endpoint closed' : 'endpoint open'} />}
                {Number.isFinite(interval.end) && <circle cx={endX} cy="52" r="7" className={interval.rightClosed ? 'endpoint closed' : 'endpoint open'} />}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function InequalitySolutionsVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.inequality;
  const common = allCopy.common;
  const [mode, setMode] = useState<InequalityMode>('linear');
  const [comparator, setComparator] = useState<InequalityComparator>('>=');
  const [linear, setLinear] = useState({ a: 2, b: -4 });
  const [quadratic, setQuadratic] = useState({ p: -2, q: -3 });
  const solution = mode === 'linear' ? solveLinearInequality(linear.a, linear.b, comparator) : solveQuadraticInequality(quadratic.p, quadratic.q, comparator);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('sets'))}>{common.viewFormulas}</button>
      </section>

      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div className="special-current-formula" data-testid="inequality-expression">{solution.expression}</div>
            <div>
              <h2>{copy.type}</h2>
              <div className="special-button-grid">
                <button type="button" className={mode === 'linear' ? 'active' : ''} onClick={() => setMode('linear')}>{copy.linear}</button>
                <button type="button" className={mode === 'quadratic' ? 'active' : ''} onClick={() => setMode('quadratic')}>{copy.quadratic}</button>
              </div>
            </div>
            <div>
              <h2>{copy.comparison}</h2>
              <div className="special-button-grid">
                {comparatorOptions.map((item) => (
                  <button key={item.value} type="button" className={comparator === item.value ? 'active' : ''} onClick={() => setComparator(item.value)}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="special-slider-stack">
              {mode === 'linear' ? (
                <>
                  <label>
                    <span>a</span>
                    <input aria-label={copy.linearA} type="range" min="-4" max="4" step="0.5" value={linear.a} onChange={(event) => setLinear((current) => ({ ...current, a: Number(event.target.value) }))} />
                    <strong>{formatSigned(linear.a)}</strong>
                  </label>
                  <label>
                    <span>b</span>
                    <input aria-label={copy.constantB} type="range" min="-8" max="8" step="0.5" value={linear.b} onChange={(event) => setLinear((current) => ({ ...current, b: Number(event.target.value) }))} />
                    <strong>{formatSigned(linear.b)}</strong>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>p</span>
                    <input aria-label={copy.quadraticP} type="range" min="-6" max="6" step="0.5" value={quadratic.p} onChange={(event) => setQuadratic((current) => ({ ...current, p: Number(event.target.value) }))} />
                    <strong>{formatSigned(quadratic.p)}</strong>
                  </label>
                  <label>
                    <span>q</span>
                    <input aria-label={copy.quadraticQ} type="range" min="-8" max="8" step="0.5" value={quadratic.q} onChange={(event) => setQuadratic((current) => ({ ...current, q: Number(event.target.value) }))} />
                    <strong>{formatSigned(quadratic.q)}</strong>
                  </label>
                </>
              )}
            </div>
            <div className="special-result-card" data-testid="inequality-result">
              <span>{copy.solutionSet}</span>
              <strong>{localizeInequalityText(solution.text, copy)}</strong>
              <p>{copy.resultBody}</p>
            </div>
          </aside>
          <div className="special-graph-panel">
            <InequalityGraphSvg mode={mode} comparator={comparator} linear={linear} quadratic={quadratic} copy={copy} />
            <NumberLineSvg intervals={solution.intervals} copy={copy} />
            <div className="special-visual-legend" aria-label={copy.legendAria}>
              <span><i className="solid blue" />{copy.functionGraph}</span>
              <span><i className="solid amber" />{copy.satisfyingX}</span>
              <span><i className="endpoint open" />{copy.endpointExcluded}</span>
              <span><i className="endpoint closed" />{copy.endpointIncluded}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support">
        <article>
          <h2>{copy.boundaries}</h2>
          <p>{copy.boundariesBody}</p>
        </article>
        <article>
          <h2>{common.relatedPractice}</h2>
          <p>{copy.relatedBody}</p>
          <button type="button" onClick={() => onNavigate(subjectPath('math'))}>{common.backToMathPractice}</button>
        </article>
      </section>
    </div>
  );
}

function SequenceSvg({ values, copy }: { values: number[]; copy: Record<string, any> }) {
  const width = 640;
  const height = 340;
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
  const zeroY = height / 2;
  const barWidth = (width - 70) / values.length - 8;
  return (
    <svg className="special-sequence-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <line x1="36" y1={zeroY} x2={width - 20} y2={zeroY} className="axis" />
      {values.map((value, index) => {
        const x = 44 + index * (barWidth + 8);
        const h = Math.min(132, Math.abs(value) / maxAbs * 126 + 6);
        const y = value >= 0 ? zeroY - h : zeroY;
        return (
          <g key={`term-${index + 1}`}>
            <rect x={x} y={y} width={barWidth} height={h} rx="6" className={value >= 0 ? 'bar positive' : 'bar negative'} />
            <text x={x + barWidth / 2} y={value >= 0 ? y - 8 : y + h + 18} className="value-label">{formatNumber(value)}</text>
            <text x={x + barWidth / 2} y={height - 18} className="index-label">{index + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function SequenceVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.sequence;
  const common = allCopy.common;
  const [mode, setMode] = useState<SequenceMode>('arithmetic');
  const [params, setParams] = useState({ first: 2, diff: 3, ratio: 1.4, count: 10 });
  const values = sequenceValues(mode, params);
  const sum = values.reduce((total, value) => total + value, 0);
  const formula = mode === 'arithmetic'
    ? `aₙ = ${formatNumber(params.first)} + (n-1)·${formatNumber(params.diff)}`
    : `aₙ = ${formatNumber(params.first)}·${formatNumber(params.ratio)}ⁿ⁻¹`;

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('functions'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div className="special-current-formula" data-testid="sequence-formula">{formula}</div>
            <div className="special-button-grid">
              <button type="button" className={mode === 'arithmetic' ? 'active' : ''} onClick={() => setMode('arithmetic')}>{copy.arithmetic}</button>
              <button type="button" className={mode === 'geometric' ? 'active' : ''} onClick={() => setMode('geometric')}>{copy.geometric}</button>
            </div>
            <div className="special-slider-stack">
              <label><span>a₁</span><input aria-label={copy.firstTerm} type="range" min="-8" max="8" step="1" value={params.first} onChange={(event) => setParams((current) => ({ ...current, first: Number(event.target.value) }))} /><strong>{formatNumber(params.first)}</strong></label>
              <label><span>d</span><input aria-label={copy.commonDifference} type="range" min="-5" max="5" step="1" value={params.diff} onChange={(event) => setParams((current) => ({ ...current, diff: Number(event.target.value) }))} /><strong>{formatNumber(params.diff)}</strong></label>
              <label><span>r</span><input aria-label={copy.commonRatio} type="range" min="-2" max="2" step="0.1" value={params.ratio} onChange={(event) => setParams((current) => ({ ...current, ratio: Number(event.target.value) }))} /><strong>{formatNumber(params.ratio)}</strong></label>
              <label><span>n</span><input aria-label={copy.termCount} type="range" min="3" max="16" step="1" value={params.count} onChange={(event) => setParams((current) => ({ ...current, count: Number(event.target.value) }))} /><strong>{params.count}</strong></label>
            </div>
            <div className="special-result-card" data-testid="sequence-result"><span>{copy.partialSum}</span><strong>Sₙ = {formatNumber(sum)}</strong><p>{copy.resultBody}</p></div>
          </aside>
          <div className="special-graph-panel">
            <SequenceSvg values={values} copy={copy} />
            <div className="special-visual-legend"><span><i className="fill blue" />{copy.positiveTerm}</span><span><i className="fill orange" />{copy.negativeTerm}</span><span><i className="axis" />{copy.termPosition}</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProbabilitySvg({ probability, trials, seed, copy }: { probability: number; trials: number; seed: number; copy: Record<string, any> }) {
  const width = 640;
  const height = 360;
  let hits = 0;
  const points = Array.from({ length: trials }, (_, index) => {
    if (seededUniform(index + 1, seed) < probability) hits += 1;
    const rate = hits / (index + 1);
    const x = 30 + (index / Math.max(1, trials - 1)) * (width - 60);
    const y = height - 42 - rate * (height - 88);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const targetY = height - 42 - probability * (height - 88);

  return (
    <svg className="special-probability-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <line x1="30" y1={height - 42} x2={width - 20} y2={height - 42} className="axis" />
      <line x1="30" y1="28" x2="30" y2={height - 42} className="axis" />
      <line x1="30" y1={targetY} x2={width - 20} y2={targetY} className="target" />
      <path data-testid="probability-curve" d={points} className="probability-curve" />
      <text x={width - 136} y={targetY - 8} className="axis-label">{copy.targetProbability} {Math.round(probability * 100)}%</text>
      <text x="38" y="24" className="axis-label">{copy.frequency}</text>
      <text x={width - 58} y={height - 16} className="axis-label">{copy.trials}</text>
    </svg>
  );
}

export function ProbabilityVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.probability;
  const common = allCopy.common;
  const [probability, setProbability] = useState(0.5);
  const [trials, setTrials] = useState(80);
  const [seed, setSeed] = useState(3);
  const hits = Array.from({ length: trials }, (_, index) => seededUniform(index + 1, seed) < probability).filter(Boolean).length;
  const rate = hits / trials;

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('probability'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div className="special-current-formula" data-testid="probability-summary">P(A)={probability.toFixed(2)}, {copy.currentFrequency}={rate.toFixed(3)}</div>
            <div className="special-slider-stack">
              <label><span>p</span><input aria-label={copy.probabilityAria} type="range" min="0.1" max="0.9" step="0.05" value={probability} onChange={(event) => setProbability(Number(event.target.value))} /><strong>{probability.toFixed(2)}</strong></label>
              <label><span>n</span><input aria-label={copy.trialsAria} type="range" min="20" max="240" step="10" value={trials} onChange={(event) => setTrials(Number(event.target.value))} /><strong>{trials}</strong></label>
            </div>
            <GhostButton onClick={() => setSeed((current) => current + 1)}>{copy.runAgain}</GhostButton>
            <div className="special-result-card"><span>{copy.roundResult}</span><strong>{copy.hitsResult(hits, trials)}</strong><p>{copy.resultBody}</p></div>
          </aside>
          <div className="special-graph-panel">
            <ProbabilitySvg probability={probability} trials={trials} seed={seed} copy={copy} />
            <div className="special-visual-legend"><span><i className="solid blue" />{copy.cumulativeFrequency}</span><span><i className="dash amber" />{copy.theoreticalProbability}</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VectorSvg({ ax, ay, bx, by, copy }: { ax: number; ay: number; bx: number; by: number; copy: Record<string, any> }) {
  const width = 640;
  const height = 420;
  const scale = 32;
  const origin = { x: width / 2, y: height / 2 };
  const point = (x: number, y: number) => ({ x: origin.x + x * scale, y: origin.y - y * scale });
  const a = point(ax, ay);
  const b = point(bx, by);
  const sum = point(ax + bx, ay + by);
  const arrow = (from: { x: number; y: number }, to: { x: number; y: number }, className: string, id: string) => (
    <g className={className} data-testid={id}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle cx={to.x} cy={to.y} r="5" />
    </g>
  );
  return (
    <svg className="special-vector-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs><pattern id="vector-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(99,114,138,.08)" /></pattern></defs>
      <rect width={width} height={height} fill="url(#vector-grid)" />
      <line x1="0" y1={origin.y} x2={width} y2={origin.y} className="axis" />
      <line x1={origin.x} y1="0" x2={origin.x} y2={height} className="axis" />
      <line x1={a.x} y1={a.y} x2={sum.x} y2={sum.y} className="helper" />
      <line x1={b.x} y1={b.y} x2={sum.x} y2={sum.y} className="helper" />
      {arrow(origin, a, 'vector-a', 'vector-a')}
      {arrow(origin, b, 'vector-b', 'vector-b')}
      {arrow(origin, sum, 'vector-sum', 'vector-sum')}
      <text x={a.x + 8} y={a.y - 8} className="vector-label">a</text>
      <text x={b.x + 8} y={b.y - 8} className="vector-label">b</text>
      <text x={sum.x + 8} y={sum.y - 8} className="vector-label">a+b</text>
    </svg>
  );
}

export function VectorOperationsVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.vector;
  const common = allCopy.common;
  const [vector, setVector] = useState({ ax: 4, ay: 2, bx: 1, by: 4 });
  const dot = vector.ax * vector.bx + vector.ay * vector.by;
  const lenA = Math.hypot(vector.ax, vector.ay);
  const lenB = Math.hypot(vector.bx, vector.by);
  const angle = lenA && lenB ? Math.acos(Math.max(-1, Math.min(1, dot / (lenA * lenB)))) * 180 / Math.PI : 0;
  const setValue = (key: keyof typeof vector, value: number) => setVector((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('geometry'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div className="special-current-formula" data-testid="vector-summary">a·b = {formatNumber(dot)}, {copy.angle} ≈ {formatNumber(angle)}°</div>
            <div className="special-slider-stack">
              {(['ax', 'ay', 'bx', 'by'] as const).map((key) => (
                <label key={key}><span>{key}</span><input aria-label={copy.vectorAria(key)} type="range" min="-6" max="6" step="1" value={vector[key]} onChange={(event) => setValue(key, Number(event.target.value))} /><strong>{vector[key]}</strong></label>
              ))}
            </div>
            <div className="special-result-card"><span>{copy.componentResult}</span><strong>a+b = ({vector.ax + vector.bx}, {vector.ay + vector.by})</strong><p>{copy.resultBody}</p></div>
          </aside>
          <div className="special-graph-panel">
            <VectorSvg {...vector} copy={copy} />
            <div className="special-visual-legend"><span><i className="solid blue" />{copy.vectorA}</span><span><i className="solid red" />{copy.vectorB}</span><span><i className="solid amber" />a+b</span><span><i className="dash" />{copy.guides}</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ConicSvg({ mode, a, b, p, copy }: { mode: ConicMode; a: number; b: number; p: number; copy: Record<string, any> }) {
  const width = 640;
  const height = 420;
  const cx = width / 2;
  const cy = height / 2;
  const scale = 34;
  const ellipsePath = `M ${cx - a * scale} ${cy} C ${cx - a * scale} ${cy - b * scale * .55}, ${cx - a * scale * .55} ${cy - b * scale}, ${cx} ${cy - b * scale} C ${cx + a * scale * .55} ${cy - b * scale}, ${cx + a * scale} ${cy - b * scale * .55}, ${cx + a * scale} ${cy} C ${cx + a * scale} ${cy + b * scale * .55}, ${cx + a * scale * .55} ${cy + b * scale}, ${cx} ${cy + b * scale} C ${cx - a * scale * .55} ${cy + b * scale}, ${cx - a * scale} ${cy + b * scale * .55}, ${cx - a * scale} ${cy} Z`;
  const parabolaPath = buildCartesianPath((x) => (x * x) / (2 * Math.max(.5, p)), { width, height, xMin: -7, xMax: 7, yMin: -4, yMax: 8 });
  const hyperbolaRight = buildCartesianPath((x) => Math.abs(x) < a ? null : b * Math.sqrt((x * x) / (a * a) - 1), { width, height, xMin: -8, xMax: 8, yMin: -6, yMax: 6 });
  const hyperbolaLeft = buildCartesianPath((x) => Math.abs(x) < a ? null : -b * Math.sqrt((x * x) / (a * a) - 1), { width, height, xMin: -8, xMax: 8, yMin: -6, yMax: 6 });
  const focus = mode === 'ellipse' ? Math.sqrt(Math.max(0, a * a - b * b)) : p / 2;

  return (
    <svg className="special-conic-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs><pattern id="conic-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(99,114,138,.08)" /></pattern></defs>
      <rect width={width} height={height} fill="url(#conic-grid)" />
      <line x1="0" y1={cy} x2={width} y2={cy} className="axis" />
      <line x1={cx} y1="0" x2={cx} y2={height} className="axis" />
      {mode === 'ellipse' && <path data-testid="conic-curve" d={ellipsePath} className="conic-curve fill" />}
      {mode === 'parabola' && <path data-testid="conic-curve" d={parabolaPath} className="conic-curve" />}
      {mode === 'hyperbola' && (
        <>
          <line x1={cx - 250} y1={cy + (b / a) * 250} x2={cx + 250} y2={cy - (b / a) * 250} className="helper" />
          <line x1={cx - 250} y1={cy - (b / a) * 250} x2={cx + 250} y2={cy + (b / a) * 250} className="helper" />
          <path data-testid="conic-curve" d={`${hyperbolaRight} ${hyperbolaLeft}`} className="conic-curve" />
        </>
      )}
      {mode === 'ellipse' && (
        <>
          <circle cx={cx - focus * scale} cy={cy} r="5" className="focus" />
          <circle cx={cx + focus * scale} cy={cy} r="5" className="focus" />
        </>
      )}
      {mode === 'parabola' && <circle cx={cx} cy={cy - focus * scale} r="5" className="focus" />}
    </svg>
  );
}

export function ConicSectionsVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.conic;
  const common = allCopy.common;
  const [mode, setMode] = useState<ConicMode>('ellipse');
  const [params, setParams] = useState({ a: 4, b: 2.5, p: 3 });
  const formula = mode === 'ellipse'
    ? `x²/${formatNumber(params.a ** 2)} + y²/${formatNumber(params.b ** 2)} = 1`
    : mode === 'parabola'
      ? `x² = ${formatNumber(2 * params.p)}y`
      : `x²/${formatNumber(params.a ** 2)} - y²/${formatNumber(params.b ** 2)} = 1`;
  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p className="page-body">{copy.body}</p></div>
        <button type="button" onClick={() => onNavigate(formulaPath('geometry'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card"><div className="special-visualizer-layout">
        <aside className="special-control-panel">
          <div className="special-current-formula" data-testid="conic-formula">{formula}</div>
          <div className="special-button-grid">
            <button type="button" className={mode === 'ellipse' ? 'active' : ''} onClick={() => setMode('ellipse')}>{copy.modes.ellipse}</button>
            <button type="button" className={mode === 'parabola' ? 'active' : ''} onClick={() => setMode('parabola')}>{copy.modes.parabola}</button>
            <button type="button" className={mode === 'hyperbola' ? 'active' : ''} onClick={() => setMode('hyperbola')}>{copy.modes.hyperbola}</button>
          </div>
          <div className="special-slider-stack">
            <label><span>a</span><input aria-label={copy.semiAxisA} type="range" min="1" max="6" step=".5" value={params.a} onChange={(event) => setParams((current) => ({ ...current, a: Number(event.target.value) }))} /><strong>{formatNumber(params.a)}</strong></label>
            <label><span>b</span><input aria-label={copy.semiAxisB} type="range" min="1" max="5" step=".5" value={params.b} onChange={(event) => setParams((current) => ({ ...current, b: Number(event.target.value) }))} /><strong>{formatNumber(params.b)}</strong></label>
            <label><span>p</span><input aria-label={copy.focalParameter} type="range" min="1" max="6" step=".5" value={params.p} onChange={(event) => setParams((current) => ({ ...current, p: Number(event.target.value) }))} /><strong>{formatNumber(params.p)}</strong></label>
          </div>
          <div className="special-result-card"><span>{copy.observationFocus}</span><strong>{copy.focusText[mode]}</strong><p>{copy.resultBody}</p></div>
        </aside>
        <div className="special-graph-panel"><ConicSvg mode={mode} {...params} copy={copy} /><div className="special-visual-legend"><span><i className="solid blue" />{copy.curve}</span><span><i className="solid amber" />{copy.focus}</span><span><i className="dash" />{copy.guide}</span></div></div>
      </div></section>
    </div>
  );
}

function Coordinate3dSvg({ a, b, copy }: { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number }; copy: Record<string, any> }) {
  const pa = project3d(a);
  const pb = project3d(b);
  const origin = project3d({ x: 0, y: 0, z: 0 });
  const ax = project3d({ x: 6, y: 0, z: 0 });
  const ay = project3d({ x: 0, y: 6, z: 0 });
  const az = project3d({ x: 0, y: 0, z: 5 });
  return (
    <svg className="special-coordinate-svg" viewBox="0 0 640 420" role="img" aria-label={copy.svgAria}>
      <line x1={origin.x} y1={origin.y} x2={ax.x} y2={ax.y} className="axis x" /><text x={ax.x + 10} y={ax.y} className="axis-label">x</text>
      <line x1={origin.x} y1={origin.y} x2={ay.x} y2={ay.y} className="axis y" /><text x={ay.x + 8} y={ay.y + 16} className="axis-label">y</text>
      <line x1={origin.x} y1={origin.y} x2={az.x} y2={az.y} className="axis z" /><text x={az.x + 8} y={az.y} className="axis-label">z</text>
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className="segment" />
      <circle data-testid="coordinate-point-a" cx={pa.x} cy={pa.y} r="7" className="point a" /><text x={pa.x + 10} y={pa.y - 8} className="point-label">A</text>
      <circle cx={pb.x} cy={pb.y} r="7" className="point b" /><text x={pb.x + 10} y={pb.y - 8} className="point-label">B</text>
    </svg>
  );
}

export function CoordinateGeometryVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.coordinate;
  const common = allCopy.common;
  const [a, setA] = useState({ x: 1, y: 1, z: 1 });
  const [b, setB] = useState({ x: 4, y: 3, z: 2 });
  const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  const setPoint = (point: 'a' | 'b', key: 'x' | 'y' | 'z', value: number) => (point === 'a' ? setA : setB)((current) => ({ ...current, [key]: value }));
  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p className="page-body">{copy.body}</p></div>
        <button type="button" onClick={() => onNavigate(formulaPath('geometry'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card"><div className="special-visualizer-layout">
        <aside className="special-control-panel">
          <div className="special-current-formula" data-testid="coordinate-summary">AB = {formatNumber(distance)}, M=({formatNumber(mid.x)}, {formatNumber(mid.y)}, {formatNumber(mid.z)})</div>
          <div className="special-slider-stack">
            {(['x', 'y', 'z'] as const).map((key) => <label key={`a-${key}`}><span>A{key}</span><input aria-label={copy.pointAria('A', key)} type="range" min="-4" max="6" step="1" value={a[key]} onChange={(event) => setPoint('a', key, Number(event.target.value))} /><strong>{a[key]}</strong></label>)}
            {(['x', 'y', 'z'] as const).map((key) => <label key={`b-${key}`}><span>B{key}</span><input aria-label={copy.pointAria('B', key)} type="range" min="-4" max="6" step="1" value={b[key]} onChange={(event) => setPoint('b', key, Number(event.target.value))} /><strong>{b[key]}</strong></label>)}
          </div>
          <div className="special-result-card"><span>{copy.formula}</span><strong>d = √[(x₂-x₁)²+(y₂-y₁)²+(z₂-z₁)²]</strong><p>{copy.resultBody}</p></div>
        </aside>
        <div className="special-graph-panel"><Coordinate3dSvg a={a} b={b} copy={copy} /><div className="special-visual-legend"><span><i className="solid blue" />{copy.pointA}</span><span><i className="solid red" />{copy.pointB}</span><span><i className="solid amber" />{copy.segment}</span></div></div>
      </div></section>
    </div>
  );
}

function solidMetrics(mode: SolidMode, params: { side: number; width: number; depth: number; height: number; radius: number }) {
  if (mode === 'cube') return { formula: 'V=a³, S=6a²', volume: params.side ** 3, area: 6 * params.side ** 2 };
  if (mode === 'cuboid') return { formula: 'V=abc, S=2(ab+bc+ac)', volume: params.width * params.depth * params.height, area: 2 * (params.width * params.depth + params.depth * params.height + params.width * params.height) };
  if (mode === 'cylinder') return { formula: 'V=πr²h, S=2πr²+2πrh', volume: Math.PI * params.radius ** 2 * params.height, area: 2 * Math.PI * params.radius ** 2 + 2 * Math.PI * params.radius * params.height };
  if (mode === 'cone') {
    const l = Math.hypot(params.radius, params.height);
    return { formula: 'V=1/3πr²h, S=πr²+πrl', volume: Math.PI * params.radius ** 2 * params.height / 3, area: Math.PI * params.radius ** 2 + Math.PI * params.radius * l };
  }
  if (mode === 'sphere') return { formula: 'V=4/3πr³, S=4πr²', volume: 4 * Math.PI * params.radius ** 3 / 3, area: 4 * Math.PI * params.radius ** 2 };
  return { formula: 'V=1/2abh, S=ab+2hl+bl', volume: params.width * params.depth * params.height / 2, area: params.width * params.depth + 2 * params.height * Math.hypot(params.width / 2, params.depth) + params.width * params.height };
}

export function SolidGeometryVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.solid;
  const common = allCopy.common;
  const [mode, setMode] = useState<SolidMode>('cube');
  const [params, setParams] = useState({ side: 3, width: 4, depth: 3, height: 4, radius: 2 });
  const [viewReset, setViewReset] = useState(0);
  const metrics = solidMetrics(mode, params);
  const setParam = (key: keyof typeof params, value: number) => setParams((current) => ({ ...current, [key]: value }));
  const modes: Array<{ key: SolidMode; label: string }> = [
    { key: 'cube', label: copy.modes.cube }, { key: 'cuboid', label: copy.modes.cuboid }, { key: 'cylinder', label: copy.modes.cylinder }, { key: 'cone', label: copy.modes.cone }, { key: 'sphere', label: copy.modes.sphere }, { key: 'prism', label: copy.modes.prism }
  ];
  const controls: Partial<Record<keyof typeof params, { label: string; aria: string; min: number; max: number; step: number }>> =
    mode === 'cube'
      ? { side: { label: 'a', aria: copy.arias.side, min: 1, max: 6, step: .5 } }
      : mode === 'cuboid'
        ? {
            width: { label: copy.labels.length, aria: copy.arias.length, min: 1, max: 7, step: .5 },
            depth: { label: copy.labels.width, aria: copy.arias.width, min: 1, max: 6, step: .5 },
            height: { label: copy.labels.height, aria: copy.arias.height, min: 1, max: 7, step: .5 }
          }
        : mode === 'sphere'
          ? { radius: { label: 'r', aria: copy.arias.radius, min: 1, max: 5, step: .5 } }
          : mode === 'prism'
            ? {
                width: { label: copy.labels.base, aria: copy.arias.base, min: 1, max: 7, step: .5 },
                depth: { label: copy.labels.height, aria: copy.arias.triangleHeight, min: 1, max: 6, step: .5 },
                height: { label: copy.labels.length, aria: copy.arias.prismLength, min: 1, max: 7, step: .5 }
              }
            : {
                radius: { label: 'r', aria: copy.arias.radius, min: 1, max: 5, step: .5 },
                height: { label: 'h', aria: copy.arias.height, min: 1, max: 7, step: .5 }
              };
  const formulaParts = metrics.formula.split(', ');

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p className="page-body">{copy.body}</p></div>
        <button type="button" onClick={() => onNavigate(formulaPath('geometry'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card"><div className="special-visualizer-layout">
        <aside className="special-control-panel">
          <div className="special-solid-formula-grid" data-testid="solid-formula">{formulaParts.map((part) => <div key={part}>{part}</div>)}</div>
          <div className="special-button-grid">{modes.map((item) => <button key={item.key} type="button" className={mode === item.key ? 'active' : ''} onClick={() => setMode(item.key)}>{item.label}</button>)}</div>
          <div className="special-slider-stack">
            {(Object.entries(controls) as Array<[keyof typeof params, NonNullable<typeof controls[keyof typeof params]>]>).map(([key, control]) => (
              <label key={key}>
                <span>{control.label}</span>
                <input aria-label={control.aria} type="range" min={control.min} max={control.max} step={control.step} value={params[key]} onChange={(event) => setParam(key, Number(event.target.value))} />
                <strong>{formatNumber(params[key])}</strong>
              </label>
            ))}
          </div>
          <div className="special-result-card" data-testid="solid-result"><span>{copy.result}</span><strong>{copy.volume} {formatNumber(metrics.volume)} / {copy.surfaceArea} {formatNumber(metrics.area)}</strong><p>{copy.resultBody}</p></div>
        </aside>
        <div className="special-graph-panel">
          <SolidGeometryCanvasBoundary
            fallback={
              <div className="special-solid-canvas-wrap" data-testid="solid-three-panel">
                <div className="special-solid-canvas-fallback">{copy.loadError}</div>
              </div>
            }
          >
            <Suspense fallback={<div className="special-solid-canvas-wrap" data-testid="solid-three-panel"><div className="special-solid-canvas-fallback">{copy.loading}</div></div>}>
              <SolidGeometryCanvas mode={mode} params={params} resetSignal={viewReset} />
            </Suspense>
          </SolidGeometryCanvasBoundary>
          <div className="special-visual-legend">
            <span><i className="solid blue" />{copy.mainSolid}</span>
            <span><i className="dash" />{copy.axesGuides}</span>
            <span><i className="fill blue" />{copy.transparentSurface}</span>
            <button type="button" className="special-solid-reset" onClick={() => setViewReset((value) => value + 1)}>{copy.resetView}</button>
          </div>
        </div>
      </div></section>
    </div>
  );
}

function CalculusSvg({ mode, point, left, right, copy }: { mode: CalculusMode; point: number; left: number; right: number; copy: Record<string, any> }) {
  const width = 640;
  const height = 420;
  const xMin = -7;
  const xMax = 7;
  const yMin = -3;
  const yMax = 7;
  const mapX = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
  const mapY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;
  const curve = buildCartesianPath(evaluateCalculusFunction, { width, height, xMin, xMax, yMin, yMax });
  const y = evaluateCalculusFunction(point);
  const slope = calculusDerivative(point);
  const tangent = `M ${mapX(point - 4)} ${mapY(y - 4 * slope)} L ${mapX(point + 4)} ${mapY(y + 4 * slope)}`;
  const areaParts: string[] = [];
  for (let i = 0; i <= 80; i += 1) {
    const x = left + ((right - left) * i) / 80;
    areaParts.push(`${i === 0 ? 'M' : 'L'} ${mapX(x).toFixed(2)} ${mapY(evaluateCalculusFunction(x)).toFixed(2)}`);
  }
  const areaPath = `${areaParts.join(' ')} L ${mapX(right)} ${mapY(0)} L ${mapX(left)} ${mapY(0)} Z`;
  return (
    <svg className="special-calculus-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs><pattern id="calculus-grid" width="40" height="42" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 42" fill="none" stroke="rgba(99,114,138,.08)" /></pattern></defs>
      <rect width={width} height={height} fill="url(#calculus-grid)" />
      <line x1="0" y1={mapY(0)} x2={width} y2={mapY(0)} className="axis" />
      <line x1={mapX(0)} y1="0" x2={mapX(0)} y2={height} className="axis" />
      {mode === 'integral' && <path data-testid="calculus-area" d={areaPath} className="area-fill" />}
      <path data-testid="calculus-curve" d={curve} className="calculus-curve" />
      {mode === 'derivative' && <path d={tangent} className="tangent-line" />}
      <circle cx={mapX(point)} cy={mapY(y)} r="6" className="calculus-point" />
    </svg>
  );
}

export function CalculusVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.calculus;
  const common = allCopy.common;
  const [mode, setMode] = useState<CalculusMode>('derivative');
  const [point, setPoint] = useState(-1);
  const [range, setRange] = useState({ left: -3, right: 3 });
  const slope = calculusDerivative(point);
  const area = calculusAntiderivative(range.right) - calculusAntiderivative(range.left);
  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div><p className="page-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p className="page-body">{copy.body}</p></div>
        <button type="button" onClick={() => onNavigate(formulaPath('functions'))}>{common.viewFormulas}</button>
      </section>
      <section className="special-visualizer-card"><div className="special-visualizer-layout">
        <aside className="special-control-panel">
          <div className="special-current-formula" data-testid="calculus-summary">{mode === 'derivative' ? `f'( ${formatNumber(point)} ) = ${formatNumber(slope)}` : `∫ f(x)dx ≈ ${formatNumber(area)}`}</div>
          <div className="special-button-grid"><button type="button" className={mode === 'derivative' ? 'active' : ''} onClick={() => setMode('derivative')}>{copy.derivative}</button><button type="button" className={mode === 'integral' ? 'active' : ''} onClick={() => setMode('integral')}>{copy.integral}</button></div>
          <div className="special-reference-note"><strong>{copy.currentFunction}</strong><p>f(x)=0.22x²-1.1, f'(x)=0.44x</p></div>
          <div className="special-slider-stack">
            <label><span>x</span><input aria-label={copy.tangentPoint} type="range" min="-6" max="6" step=".1" value={point} onChange={(event) => setPoint(Number(event.target.value))} /><strong>{formatNumber(point)}</strong></label>
            <label><span>a</span><input aria-label={copy.integralLeft} type="range" min="-6" max="5" step=".5" value={range.left} onChange={(event) => setRange((current) => ({ ...current, left: Math.min(Number(event.target.value), current.right - .5) }))} /><strong>{formatNumber(range.left)}</strong></label>
            <label><span>b</span><input aria-label={copy.integralRight} type="range" min="-5" max="6" step=".5" value={range.right} onChange={(event) => setRange((current) => ({ ...current, right: Math.max(Number(event.target.value), current.left + .5) }))} /><strong>{formatNumber(range.right)}</strong></label>
          </div>
          <div className="special-result-card"><span>{copy.keyIdea}</span><strong>{copy.keyIdeaText[mode]}</strong><p>{copy.resultBody}</p></div>
        </aside>
        <div className="special-graph-panel"><CalculusSvg mode={mode} point={point} left={range.left} right={range.right} copy={copy} /><div className="special-visual-legend"><span><i className="solid blue" />{copy.functionCurve}</span><span><i className="solid red" />{copy.tangentLine}</span><span><i className="fill orange" />{copy.signedArea}</span></div></div>
      </div></section>
    </div>
  );
}

function SetVennSvg({ operation, copy }: { operation: SetOperationKey; copy: Record<string, any> }) {
  const result = getSetOperationResult(operation);
  const resultSet = new Set(result);
  const activeA = operation === 'union' || operation === 'aMinusB' || operation === 'bComplement' || operation === 'symmetricDifference';
  const activeB = operation === 'union' || operation === 'bMinusA' || operation === 'aComplement' || operation === 'symmetricDifference';
  const activeIntersection = operation === 'union' || operation === 'intersection';
  const activeOutside = operation === 'aComplement' || operation === 'bComplement';

  return (
    <svg className="special-venn-svg" viewBox="0 0 620 380" role="img" aria-label={copy.svgAria}>
      <rect x="18" y="24" width="584" height="320" rx="18" className={activeOutside ? 'region outside active' : 'region outside'} />
      <text x="42" y="58" className="venn-label">U</text>
      <circle cx="260" cy="194" r="112" className={activeA ? 'region a active' : 'region a'} />
      <circle cx="370" cy="194" r="112" className={activeB ? 'region b active' : 'region b'} />
      <path d="M 315 93 C 262 124 241 169 241 194 C 241 219 262 264 315 295 C 368 264 389 219 389 194 C 389 169 368 124 315 93 Z" className={activeIntersection ? 'region intersection active' : 'region intersection'} />
      <circle cx="260" cy="194" r="112" className="outline a" />
      <circle cx="370" cy="194" r="112" className="outline b" />
      <text x="205" y="92" className="set-label a">A</text>
      <text x="425" y="92" className="set-label b">B</text>
      <text x="204" y="205" className={resultSet.has(1) || resultSet.has(4) ? 'elements active' : 'elements'}>1, 4</text>
      <text x="296" y="205" className={resultSet.has(2) || resultSet.has(5) ? 'elements active' : 'elements'}>2, 5</text>
      <text x="438" y="205" className={resultSet.has(3) || resultSet.has(7) ? 'elements active' : 'elements'}>3, 7</text>
      <text x="500" y="82" className={resultSet.has(6) || resultSet.has(8) ? 'elements active' : 'elements'}>6, 8</text>
    </svg>
  );
}

export function SetOperationsVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const allCopy = pickLocalized(MATH_VISUALIZER_COPY, locale);
  const copy = allCopy.set;
  const common = allCopy.common;
  const [operation, setOperation] = useState<SetOperationKey>('union');
  const selected = setOperationOptions.find((item) => item.key === operation) ?? setOperationOptions[0];
  const selectedCopy = copy.operations[selected.key];
  const result = getSetOperationResult(operation);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page">
      <section className="special-visualizer-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(MATH_VISUALIZERS_PATH)}>{common.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
        </div>
        <button type="button" onClick={() => onNavigate(formulaPath('sets'))}>{common.viewFormulas}</button>
      </section>

      <section className="special-visualizer-card">
        <div className="special-visualizer-layout">
          <aside className="special-control-panel">
            <div>
              <h2>{copy.operation}</h2>
              <div className="special-operation-list">
                {setOperationOptions.map((item) => (
                  <button key={item.key} type="button" className={operation === item.key ? 'active' : ''} onClick={() => setOperation(item.key)}>
                    <b>{item.label}</b>
                    <span>{copy.operations[item.key].name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="special-result-card" data-testid="set-result">
              <span>{copy.currentResult}</span>
              <strong>{selected.label} = {'{'}{result.join(', ')}{'}'}</strong>
              <p>{selectedCopy.description}</p>
            </div>
            <div className="special-reference-note">
              <strong>{copy.deMorgan}</strong>
              <p>(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ</p>
              <p>(A ∩ B)ᶜ = Aᶜ ∪ Bᶜ</p>
            </div>
          </aside>
          <div className="special-graph-panel">
            <div className="special-set-tabs">
              {setOperationOptions.map((item) => (
                <button key={item.key} type="button" className={operation === item.key ? 'active' : ''} onClick={() => setOperation(item.key)}>{item.label}</button>
              ))}
            </div>
            <SetVennSvg operation={operation} copy={copy} />
            <div className="special-visual-legend" aria-label={copy.legendAria}>
              <span><i className="fill blue" />{copy.onlyA}</span>
              <span><i className="fill orange" />{copy.onlyB}</span>
              <span><i className="fill violet" />{copy.intersection}</span>
              <span><i className="fill gray" />{copy.outside}</span>
            </div>
            <p className="special-venn-caption">{copy.universalSet} U = {'{'}1,2,3,4,5,6,7,8{'}'}; A = {'{'}1,2,4,5{'}'}; B = {'{'}2,3,5,7{'}'}</p>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support">
        <article>
          <h2>{copy.readVenn}</h2>
          <p>{copy.readVennBody}</p>
        </article>
        <article>
          <h2>{common.relatedPractice}</h2>
          <p>{copy.relatedBody}</p>
          <button type="button" onClick={() => onNavigate(subjectPath('math'))}>{common.backToMathPractice}</button>
        </article>
      </section>
    </div>
  );
}

