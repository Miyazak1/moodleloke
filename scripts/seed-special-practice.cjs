const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const LETTERS = ['A', 'B', 'C', 'D'];
const OBSOLETE_TOPIC_SLUGS = [
  'math-statistics',
  'chemistry-periodic',
  'chemistry-solution',
  'chemistry-organic-reaction'
];

const SUBJECTS = [
  {
    id: 'math',
    title: '数学',
    modules: [
      {
        name: '函数',
        topics: [
          ['math-function-basic', '基本初等函数', '识别一次、二次、指数、对数和幂函数的图像与性质。'],
          ['math-sequence', '数列', '掌握等差数列、等比数列、通项公式和前 n 项和。'],
          ['math-function', '函数', '训练定义域、值域、单调性、奇偶性和图像变换。'],
          ['math-calculus', '导数与微积分', '理解变化率、切线斜率、面积累积和简单应用。']
        ]
      },
      {
        name: '几何与代数',
        topics: [
          ['math-plane-geometry', '平面解析几何', '训练直线、圆、距离、中点和斜率等基础工具。'],
          ['math-solid-vector', '向量', '理解向量加减、数量积、夹角和坐标表示。'],
          ['math-complex', '复数', '掌握复数的形式、四则运算、模和共轭。'],
          ['math-solid-geometry', '立体几何', '熟悉柱体、锥体、球体的体积、表面积和空间关系。'],
          ['math-coordinate-geometry', '空间直角坐标系', '训练空间点坐标、距离、中点和位置关系。']
        ]
      },
      {
        name: '集合与不等式',
        topics: [
          ['math-inequality', '不等式', '训练一元一次不等式、二次不等式和区间表示。'],
          ['math-set', '集合', '掌握集合表示、交集、并集、补集和元素关系。']
        ]
      },
      {
        name: '概率与统计',
        topics: [
          ['math-probability', '概率与统计', '训练古典概型、排列组合、均值、中位数、方差和数据解读。']
        ]
      }
    ]
  },
  {
    id: 'physics',
    title: '物理',
    modules: [
      {
        name: '力学',
        topics: [
          ['physics-force', '牛顿运动定律', '牛顿运动定律是经典力学的核心，包含三大定律、惯性定律、加速度与力的关系、作用力与反作用力。'],
          ['physics-motion', '运动学', '通过位移、速度、加速度和图像理解直线运动的基本规律。'],
          ['physics-work-energy', '功与能', '理解功、动能、势能和机械能守恒，训练能量转化与做功关系。'],
          ['physics-circular-gravity', '圆周运动与万有引力', '掌握圆周运动向心力、周期、线速度以及万有引力的基本应用。'],
          ['physics-momentum', '动量与冲量', '理解动量、冲量和动量守恒，处理碰撞与相互作用问题。']
        ]
      },
      {
        name: '电磁学',
        topics: [
          ['physics-electrostatic-field', '静电场', '理解电荷、电场强度、电势差和电场力的基本关系。'],
          ['physics-magnetic', '磁场', '掌握磁感线、安培力、洛伦兹力和磁场方向判断。'],
          ['physics-circuit', '直流电路', '训练欧姆定律、串并联、电功率和简单电路分析。'],
          ['physics-electromagnetic-induction', '电磁感应', '理解磁通量变化、感应电流方向和法拉第电磁感应定律。']
        ]
      },
      {
        name: '波动与光学',
        topics: [
          ['physics-harmonic-wave', '简谐振动与机械波', '掌握周期、频率、波速和机械波传播的基本关系。'],
          ['physics-geometric-optics', '几何光学', '训练反射、折射、透镜成像和光路判断。'],
          ['physics-physical-optics', '物理光学', '理解干涉、衍射和偏振等波动光学现象。'],
          ['physics-optics', '光学', '综合复习几何光学和波动光学的常见模型。']
        ]
      },
      {
        name: '热学',
        topics: [
          ['physics-ideal-gas', '理想气体状态方程', '用状态方程分析压强、体积、温度之间的关系。'],
          ['physics-molecular-kinetic', '分子动理论', '理解分子热运动、温度微观意义和内能。'],
          ['physics-thermodynamics-first-law', '热力学第一定律', '训练热量、做功和内能变化之间的能量关系。'],
          ['physics-thermal', '热学', '综合复习热量、比热容、热平衡和热学计算。']
        ]
      },
      {
        name: '近代物理',
        topics: [
          ['physics-photoelectric-effect', '光电效应', '理解光电效应现象、逸出功和光的粒子性。'],
          ['physics-atomic', '原子结构', '掌握能级、原子核外结构和跃迁辐射。'],
          ['physics-nuclear', '核物理基础', '理解核组成、核反应、半衰期和质量亏损。'],
          ['physics-modern', '近代物理', '综合复习光电效应、原子结构和核物理基础。']
        ]
      }
    ]
  },
  {
    id: 'chemistry',
    title: '化学',
    modules: [
      {
        name: '基础概念',
        topics: [
          ['chemistry-amount-calculation', '物质的量计算', '训练物质的量、摩尔质量、粒子数和气体体积之间的换算。'],
          ['chemistry-classification-state', '物质分类与状态变化', '识别混合物、纯净物、酸碱盐和物理/化学变化。'],
          ['chemistry-atomic-structure', '原子结构与元素周期律', '理解原子结构、元素周期律和常见性质递变。'],
          ['chemistry-chemical-bonding', '化学键与分子间作用力', '区分离子键、共价键、金属键和分子间作用力。'],
          ['chemistry-notation-equation', '化学用语与方程式', '掌握化学式、化合价、离子符号和方程式配平。']
        ]
      },
      {
        name: '反应原理',
        topics: [
          ['chemistry-redox', '氧化还原反应', '判断化合价变化、氧化剂和还原剂。'],
          ['chemistry-ion', '离子反应与检验', '掌握离子反应条件、离子方程式和常见离子检验。'],
          ['chemistry-equilibrium', '化学反应速率与平衡', '理解反应速率、可逆反应、平衡移动和影响因素。']
        ]
      },
      {
        name: '溶液化学',
        topics: [
          ['chemistry-electrolyte-solution', '电解质溶液理论', '理解电离、强弱电解质、导电性和离子浓度关系。'],
          ['chemistry-concentration-ph', '溶液浓度与pH', '训练物质的量浓度、稀释、酸碱性和 pH 判断。'],
          ['chemistry-ideal-gas', '理想气体状态方程', '用气体状态方程分析压强、体积、温度和物质的量。']
        ]
      },
      {
        name: '物质与应用',
        topics: [
          ['chemistry-inorganic-properties', '常见无机物性质', '梳理酸、碱、盐、氧化物、金属和非金属的典型性质。'],
          ['chemistry-organic-basic', '基础有机化合物', '认识烃、官能团、同分异构和常见有机反应。'],
          ['chemistry-experiment-application', '化学实验与应用', '训练实验操作、现象判断、物质检验和实验安全。'],
          ['chemistry-industrial-process', '工业化工流程', '理解工业制备、原料利用、条件选择和流程判断。']
        ]
      }
    ]
  }
];

const TOPIC_DISPLAY_META = {
  'math-function-basic': {
    overview: '基本初等函数是数学的基础，主要包括幂函数、指数函数、对数函数、三角函数和反三角函数。在 CSCA 考试中，这部分内容常以函数图像变换、性质分析、方程求解等形式出现，要求考生熟练掌握定义、图像和基本性质，并能灵活应用于问题解决。',
    focusItems: [
      '函数定义域、值域与基本性质分析',
      '函数图像的识别、绘制与变换（平移、伸缩）',
      '利用函数性质解方程或不等式',
      '三角函数诱导公式与特殊角求值'
    ],
    studyAdvice: '建议通过绘制函数图像对比记忆各类函数的特征，并重点练习图像变换与性质综合应用题。',
    frequencyLabel: '高频',
    difficultyLabel: '考频中',
    relatedVisualizerSlug: 'elementary-functions',
    relatedResources: [
      { label: '数学学习指南', path: '/csca-subjects/math' },
      { label: '数学术语表', path: '/csca-subjects/math/vocabulary' }
    ]
  },
  'math-sequence': { frequencyLabel: '中频', difficultyLabel: '基础', relatedVisualizerSlug: 'sequence-visualizer' },
  'math-function': { frequencyLabel: '高频', difficultyLabel: '考频中', relatedVisualizerSlug: 'function-transformations' },
  'math-calculus': { frequencyLabel: '低频', difficultyLabel: '提高', relatedVisualizerSlug: 'calculus-area' },
  'math-plane-geometry': { frequencyLabel: '高频', difficultyLabel: '考频高', relatedVisualizerSlug: 'coordinate-geometry' },
  'math-solid-vector': { frequencyLabel: '中频', difficultyLabel: '考频低', relatedVisualizerSlug: 'vector-operations' },
  'math-complex': { frequencyLabel: '中频', difficultyLabel: '基础' },
  'math-solid-geometry': { frequencyLabel: '中频', difficultyLabel: '基础', relatedVisualizerSlug: 'solid-geometry' },
  'math-coordinate-geometry': { frequencyLabel: '中频', difficultyLabel: '基础', relatedVisualizerSlug: 'coordinate-geometry' },
  'math-inequality': { frequencyLabel: '高频', difficultyLabel: '考频中', relatedVisualizerSlug: 'inequality-solutions' },
  'math-set': { frequencyLabel: '高频', difficultyLabel: '易错', relatedVisualizerSlug: 'set-operations' },
  'math-probability': { frequencyLabel: '中频', difficultyLabel: '考频低', relatedVisualizerSlug: 'probability-simulator' },
  'physics-force': { frequencyLabel: '考频高', difficultyLabel: '冲刺重点' },
  'physics-motion': { frequencyLabel: '考频高', difficultyLabel: '冲刺重点' },
  'physics-work-energy': { frequencyLabel: '考频中', difficultyLabel: '基础' },
  'physics-circular-gravity': { frequencyLabel: '考频中', difficultyLabel: '基础' },
  'physics-momentum': { frequencyLabel: '考频低', difficultyLabel: '基础' },
  'physics-electrostatic-field': { frequencyLabel: '考频中', difficultyLabel: '基础' },
  'physics-magnetic': { frequencyLabel: '考频中', difficultyLabel: '冲刺重点' },
  'physics-circuit': { frequencyLabel: '考频中', difficultyLabel: '基础' },
  'physics-electromagnetic-induction': { frequencyLabel: '考频低', difficultyLabel: '基础' },
  'physics-harmonic-wave': { frequencyLabel: '考频低', difficultyLabel: '基础' },
  'physics-geometric-optics': { frequencyLabel: '考频低', difficultyLabel: '基础' },
  'physics-physical-optics': { frequencyLabel: '基础考点', difficultyLabel: '基础' },
  'physics-optics': { frequencyLabel: '综合练习', difficultyLabel: '基础' },
  'physics-ideal-gas': { frequencyLabel: '考频低', difficultyLabel: '基础考点' },
  'physics-molecular-kinetic': { frequencyLabel: '基础考点', difficultyLabel: '基础' },
  'physics-thermodynamics-first-law': { frequencyLabel: '基础考点', difficultyLabel: '基础' },
  'physics-thermal': { frequencyLabel: '综合练习', difficultyLabel: '基础' },
  'physics-photoelectric-effect': { frequencyLabel: '基础考点', difficultyLabel: '基础' },
  'physics-atomic': { frequencyLabel: '基础考点', difficultyLabel: '基础' },
  'physics-nuclear': { frequencyLabel: '基础考点', difficultyLabel: '基础' },
  'physics-modern': { frequencyLabel: '综合练习', difficultyLabel: '基础' },
  'chemistry-amount-calculation': { frequencyLabel: '高频', difficultyLabel: '基础' },
  'chemistry-classification-state': { frequencyLabel: '高频', difficultyLabel: '基础' },
  'chemistry-atomic-structure': { frequencyLabel: '高频', difficultyLabel: '基础' },
  'chemistry-chemical-bonding': { frequencyLabel: '中频', difficultyLabel: '基础' },
  'chemistry-notation-equation': { frequencyLabel: '高频', difficultyLabel: '基础' },
  'chemistry-redox': { frequencyLabel: '高频', difficultyLabel: '考频中' },
  'chemistry-ion': { frequencyLabel: '中频', difficultyLabel: '检验题' },
  'chemistry-equilibrium': { frequencyLabel: '高频', difficultyLabel: '考频中' },
  'chemistry-electrolyte-solution': { frequencyLabel: '中频', difficultyLabel: '基础' },
  'chemistry-concentration-ph': { frequencyLabel: '中频', difficultyLabel: '基础' },
  'chemistry-ideal-gas': { frequencyLabel: '中频', difficultyLabel: '基础' },
  'chemistry-inorganic-properties': { frequencyLabel: '高频', difficultyLabel: '基础' },
  'chemistry-organic-basic': { frequencyLabel: '中频', difficultyLabel: '基础' },
  'chemistry-experiment-application': { frequencyLabel: '高频', difficultyLabel: '应用题' },
  'chemistry-industrial-process': { frequencyLabel: '中频', difficultyLabel: '综合练习' }
};

function topicDisplayData(slug) {
  const meta = TOPIC_DISPLAY_META[slug] || {};
  return {
    overview: meta.overview || null,
    focusItems: meta.focusItems || undefined,
    studyAdvice: meta.studyAdvice || null,
    difficultyLabel: meta.difficultyLabel || null,
    frequencyLabel: meta.frequencyLabel || null,
    relatedResources: meta.relatedResources || undefined,
    relatedVisualizerSlug: meta.relatedVisualizerSlug || null
  };
}

const EN_MODULES = {
  '函数': 'Functions',
  '几何与代数': 'Geometry and Algebra',
  '集合与不等式': 'Sets and Inequalities',
  '概率与统计': 'Probability and Statistics',
  '力学': 'Mechanics',
  '电磁学': 'Electromagnetism',
  '波动与光学': 'Waves and Optics',
  '热学': 'Thermal Physics',
  '近代物理': 'Modern Physics',
  '基础概念': 'Basic Concepts',
  '反应原理': 'Reaction Principles',
  '溶液化学': 'Solution Chemistry',
  '物质与应用': 'Substances and Applications'
};

const EN_TOPICS = {
  'math-function-basic': ['Elementary Functions', 'Recognize the graphs and properties of linear, quadratic, exponential, logarithmic, power, and trigonometric functions.'],
  'math-sequence': ['Sequences', 'Practice arithmetic and geometric sequences, general terms, and partial sums.'],
  'math-function': ['Functions', 'Practice domains, ranges, monotonicity, parity, and graph transformations.'],
  'math-calculus': ['Derivatives and Calculus', 'Understand rates of change, tangent slopes, accumulated area, and simple applications.'],
  'math-plane-geometry': ['Plane Analytic Geometry', 'Practice lines, circles, distances, midpoints, slopes, and coordinate tools.'],
  'math-solid-vector': ['Vectors', 'Practice vector operations, dot products, angles, and coordinate representation.'],
  'math-complex': ['Complex Numbers', 'Practice forms of complex numbers, operations, modulus, and conjugates.'],
  'math-solid-geometry': ['Solid Geometry', 'Review volume, surface area, and spatial relations for common solids.'],
  'math-coordinate-geometry': ['Three-Dimensional Coordinates', 'Practice point coordinates, distances, midpoints, and spatial position.'],
  'math-inequality': ['Inequalities', 'Practice linear inequalities, quadratic inequalities, and interval notation.'],
  'math-set': ['Sets', 'Practice set notation, intersection, union, complement, and element relations.'],
  'math-probability': ['Probability and Statistics', 'Practice classical probability, counting, mean, median, variance, and data reading.'],
  'physics-force': ['Newton\'s Laws of Motion', 'Review Newton\'s three laws, inertia, acceleration-force relations, and action-reaction pairs.'],
  'physics-motion': ['Kinematics', 'Use displacement, velocity, acceleration, and graphs to describe rectilinear motion.'],
  'physics-work-energy': ['Work and Energy', 'Practice work, kinetic energy, potential energy, mechanical energy conservation, and energy transfer.'],
  'physics-circular-gravity': ['Circular Motion and Gravitation', 'Practice centripetal force, period, linear speed, and universal gravitation.'],
  'physics-momentum': ['Momentum and Impulse', 'Practice momentum, impulse, conservation of momentum, collisions, and interactions.'],
  'physics-electrostatic-field': ['Electrostatic Fields', 'Practice charge, electric field strength, potential difference, and electric force.'],
  'physics-magnetic': ['Magnetic Fields', 'Practice magnetic field lines, Ampere force, Lorentz force, and direction judgment.'],
  'physics-circuit': ['DC Circuits', 'Practice Ohm\'s law, series and parallel circuits, electric power, and circuit analysis.'],
  'physics-electromagnetic-induction': ['Electromagnetic Induction', 'Practice changing magnetic flux, induced current direction, and Faraday\'s law.'],
  'physics-harmonic-wave': ['Simple Harmonic Motion and Mechanical Waves', 'Practice period, frequency, wave speed, and wave propagation.'],
  'physics-geometric-optics': ['Geometric Optics', 'Practice reflection, refraction, lens imaging, and ray diagrams.'],
  'physics-physical-optics': ['Physical Optics', 'Understand interference, diffraction, polarization, and other wave-optics phenomena.'],
  'physics-optics': ['Optics', 'Review common models in geometric and physical optics.'],
  'physics-ideal-gas': ['Ideal Gas Law', 'Use the gas law to analyze pressure, volume, temperature, and amount of substance.'],
  'physics-molecular-kinetic': ['Molecular Kinetic Theory', 'Understand molecular thermal motion, the microscopic meaning of temperature, and internal energy.'],
  'physics-thermodynamics-first-law': ['First Law of Thermodynamics', 'Practice heat, work, and internal-energy changes.'],
  'physics-thermal': ['Thermal Physics', 'Review heat, specific heat capacity, thermal equilibrium, and thermal calculations.'],
  'physics-photoelectric-effect': ['Photoelectric Effect', 'Understand the photoelectric effect, work function, and particle nature of light.'],
  'physics-atomic': ['Atomic Structure', 'Practice energy levels, electron structure, and transition radiation.'],
  'physics-nuclear': ['Nuclear Physics Basics', 'Review nuclear composition, nuclear reactions, half-life, and mass defect.'],
  'physics-modern': ['Modern Physics', 'Review photoelectric effect, atomic structure, and nuclear physics basics.'],
  'chemistry-amount-calculation': ['Amount-of-Substance Calculations', 'Practice conversions among amount of substance, molar mass, particle number, and gas volume.'],
  'chemistry-classification-state': ['Classification of Matter and State Changes', 'Identify mixtures, pure substances, acids, bases, salts, and physical or chemical changes.'],
  'chemistry-atomic-structure': ['Atomic Structure and Periodic Trends', 'Understand atomic structure, periodic law, and common periodic trends.'],
  'chemistry-chemical-bonding': ['Chemical Bonding and Intermolecular Forces', 'Distinguish ionic, covalent, metallic bonding, and intermolecular forces.'],
  'chemistry-notation-equation': ['Chemical Notation and Equations', 'Practice formulas, valence, ion symbols, and equation balancing.'],
  'chemistry-redox': ['Redox Reactions', 'Judge valence changes, oxidizing agents, and reducing agents.'],
  'chemistry-ion': ['Ionic Reactions and Tests', 'Practice ionic reaction conditions, ionic equations, and common ion tests.'],
  'chemistry-equilibrium': ['Reaction Rate and Equilibrium', 'Understand reaction rate, reversible reactions, equilibrium shift, and influencing factors.'],
  'chemistry-electrolyte-solution': ['Electrolyte Solution Theory', 'Understand ionization, strong and weak electrolytes, conductivity, and ion concentration.'],
  'chemistry-concentration-ph': ['Solution Concentration and pH', 'Practice molar concentration, dilution, acidity/basicity, and pH judgment.'],
  'chemistry-ideal-gas': ['Ideal Gas Law', 'Use the gas law to analyze pressure, volume, temperature, and amount of substance.'],
  'chemistry-inorganic-properties': ['Properties of Common Inorganic Substances', 'Review typical properties of acids, bases, salts, oxides, metals, and nonmetals.'],
  'chemistry-organic-basic': ['Basic Organic Compounds', 'Recognize hydrocarbons, functional groups, isomerism, and common organic reactions.'],
  'chemistry-experiment-application': ['Chemistry Experiments and Applications', 'Practice operations, observations, substance tests, and laboratory safety.'],
  'chemistry-industrial-process': ['Industrial Chemical Processes', 'Understand industrial preparation, raw-material use, condition selection, and process reasoning.']
};

const EN_TAGS = {
  '定义域': 'domain',
  '值域': 'range',
  '函数性质': 'function properties',
  '函数图像': 'function graphs',
  '集合': 'sets',
  '交集': 'intersection',
  '并集': 'union',
  '补集': 'complement',
  '不等式': 'inequalities',
  '数列': 'sequences',
  '等差数列': 'arithmetic sequences',
  '等比数列': 'geometric sequences',
  '导数': 'derivatives',
  '概率': 'probability',
  '统计': 'statistics',
  '向量': 'vectors',
  '复数': 'complex numbers',
  '直线': 'lines',
  '圆': 'circles',
  '牛顿定律': 'Newton\'s laws',
  '运动学': 'kinematics',
  '功': 'work',
  '能量': 'energy',
  '电场': 'electric fields',
  '磁场': 'magnetic fields',
  '电路': 'circuits',
  '热学': 'thermal physics',
  '光学': 'optics',
  '物质的量': 'amount of substance',
  '氧化还原': 'redox',
  '离子反应': 'ionic reactions',
  '化学平衡': 'chemical equilibrium',
  'pH': 'pH',
  '化学键': 'chemical bonding',
  '有机化学': 'organic chemistry',
  '化学实验': 'chemistry experiments'
};

const OPTION_TRANSLATIONS = {
  '不变': 'unchanged',
  '保持不变': 'remains unchanged',
  '增大': 'increases',
  '减小': 'decreases',
  '变大': 'becomes larger',
  '变小': 'becomes smaller',
  '逐渐增大': 'gradually increases',
  '逐渐减小': 'gradually decreases',
  '基本不变': 'essentially unchanged',
  '逐渐增强': 'gradually strengthens',
  '逐渐减弱': 'gradually weakens',
  '变为零': 'becomes zero',
  '变为无穷大': 'becomes infinitely large',
  '大于': 'greater than',
  '小于': 'less than',
  '等于': 'equal to',
  '无法比较': 'cannot be compared',
  '无法判断': 'cannot be determined',
  '由增变减': 'changes from increasing to decreasing',
  '一直递增': 'always increasing',
  '由减变增': 'changes from decreasing to increasing',
  '一直递减': 'always decreasing',
  '有极小值': 'has a local minimum',
  '有极大值': 'has a local maximum',
  '无驻点': 'has no stationary point',
  '导数不存在': 'the derivative does not exist',
  '单调递增': 'monotonically increasing',
  '单调递减': 'monotonically decreasing',
  '先减后增': 'decreases first, then increases',
  '先增后减': 'increases first, then decreases',
  '曲线在 $x=2$ 处切线斜率': 'the slope of the tangent at $x=2$',
  '函数在 $x=2$ 处的函数值': 'the function value at $x=2$',
  '曲线面积': 'area under the curve',
  '函数零点': 'zero of the function',
  '直接猜零点': 'guess the zero directly',
  '只看常数项': 'look only at the constant term',
  '忽略定义域': 'ignore the domain',
  "求 $f\\'(x)$": "find $f\\'(x)$",
  '夹角为 $60^\\circ$': 'the angle is $60^\\circ$',
  '模长相等': 'equal magnitudes',
  '反向平行': 'parallel in opposite directions',
  '同向平行': 'parallel in the same direction',
  '不共线': 'not collinear',
  '垂直': 'perpendicular',
  '平行': 'parallel',
  '重合': 'coincident',
  '无关': 'not related',
  '先增大后减小': 'first increases, then decreases',
  '先减弱后增强': 'first weakens, then strengthens',
  '不小于': 'not less than',
  '等于 0': 'equals 0',
  '一定静止': 'must be at rest',
  '速度可能不为零': 'the velocity may be nonzero',
  '加速度一定不为零': 'the acceleration must be nonzero',
  '速度一定增大': 'the velocity must increase',
  '只改变速度大小': 'changes only the magnitude of velocity',
  '只改变速度方向': 'changes only the direction of velocity',
  '对粒子做正功': 'does positive work on the particle',
  '使动能不断增大': 'keeps increasing kinetic energy',
  '促进磁通量增大': 'promotes an increase in magnetic flux',
  '阻碍磁通量增大': 'opposes the increase in magnetic flux',
  '使电阻为零': 'makes the resistance zero',
  '与磁通量无关': 'unrelated to magnetic flux',
  '右手螺旋定则': 'right-hand screw rule',
  '左手定则': 'left-hand rule',
  '折射定律': 'law of refraction',
  '分子动理论': 'molecular kinetic theory',
  '倒立、放大、实像': 'inverted, magnified, real image',
  '正立、缩小、实像': 'upright, reduced, real image',
  '正立、等大、虚像': 'upright, same-size, virtual image',
  '倒立、等大、虚像': 'inverted, same-size, virtual image',
  '波动性': 'wave nature',
  '粒子性': 'particle nature',
  '粒子性唯一': 'only particle nature',
  '只具有机械性': 'has only mechanical nature',
  '只具有热效应': 'has only thermal effect',
  '没有能量': 'has no energy',
  '机械性': 'mechanical nature',
  '热传导性': 'thermal conductivity',
  '反射': 'reflection',
  '折射': 'refraction',
  '偏振': 'polarization',
  '衍射': 'diffraction',
  '消失': 'disappears',
  '减少 $30\\,J$': 'decreases by $30\\,J$',
  '增加 $70\\,J$': 'increases by $70\\,J$',
  '增加 $30\\,J$': 'increases by $30\\,J$',
  '不停地无规则运动': 'continuous random motion',
  '静止不动': 'remain still',
  '只沿直线运动': 'move only in a straight line',
  '没有间隙': 'have no gaps',
  '摄氏温度直接代入': 'substitute Celsius temperature directly',
  '华氏温度': 'Fahrenheit temperature',
  '热力学温度': 'thermodynamic temperature',
  '任意单位': 'any temperature unit',
  '吸收光子': 'absorbs a photon',
  '放出光子': 'emits a photon',
  '质量变为零': 'mass becomes zero',
  '电荷消失': 'charge disappears',
  '质量亏损': 'mass defect',
  '欧姆定律': "Ohm's law",
  '折射角': 'angle of refraction',
  '热容': 'heat capacity',
  '一定发生光电效应': 'the photoelectric effect must occur',
  '不能发生光电效应': 'the photoelectric effect cannot occur',
  '逸出功变小': 'the work function becomes smaller',
  '电子最大初动能变大': 'the maximum kinetic energy of electrons increases',
  '空气': 'air',
  '蒸馏水': 'distilled water',
  '海水': 'seawater',
  '黄铜': 'brass',
  '中子数': 'number of neutrons',
  '电子层数': 'number of electron shells',
  '质子数': 'number of protons',
  '相对原子质量': 'relative atomic mass',
  '共价键': 'covalent bond',
  '金属键': 'metallic bond',
  '氢键': 'hydrogen bond',
  '离子键': 'ionic bond',
  '冰融化': 'ice melting',
  '铁生锈': 'iron rusting',
  '酒精挥发': 'alcohol evaporating',
  '食盐溶解': 'table salt dissolving',
  '反应前后分子数相等': 'the number of molecules is unchanged',
  '所有物质化学计量数相同': 'all substances have the same stoichiometric coefficients',
  '生成物质量一定更大': 'products must have greater mass',
  '反应前后原子种类和数目守恒': 'the types and numbers of atoms are conserved',
  '碳和氧': 'carbon and oxygen',
  '碳和氢': 'carbon and hydrogen',
  '氢和氯': 'hydrogen and chlorine',
  '氧和氮': 'oxygen and nitrogen',
  '羧基 $-COOH$': 'carboxyl group $-COOH$',
  '醛基 $-CHO$': 'aldehyde group $-CHO$',
  '羟基 $-OH$': 'hydroxyl group $-OH$',
  '硝基 $-NO_2$': 'nitro group $-NO_2$',
  '羧基': 'carboxyl group',
  '醛基': 'aldehyde group',
  '羟基': 'hydroxyl group',
  '硝基': 'nitro group',
  '直接凑近瓶口闻': 'smell directly at the bottle mouth',
  '深吸一口气': 'take a deep breath',
  '堵住通风口闻': 'block the vent and smell',
  '用手轻轻扇闻': 'waft gently with the hand',
  '过滤': 'filtration',
  '蒸发结晶': 'evaporative crystallization',
  '萃取': 'extraction',
  '蒸馏': 'distillation',
  '沉淀反应': 'precipitation reaction',
  '降低反应速率': 'decrease the reaction rate',
  '减少目标产物': 'reduce the target product',
  '提高原料利用率': 'improve raw-material utilization',
  '使反应停止': 'stop the reaction',
  '沸点': 'boiling point',
  '官能团位置': 'position of the functional group',
  '电子转移': 'electron transfer',
  '吸收热量': 'absorbs heat',
  '溶液变色': 'solution changes color',
  '被还原': 'is reduced',
  '被氧化': 'is oxidized',
  '一定作氧化剂': 'must act as an oxidizing agent',
  '一定生成单质': 'must form a simple substance',
  '产生红褐色沉淀': 'forms a reddish-brown precipitate',
  '放出氢气': 'releases hydrogen gas',
  '产生白色沉淀': 'forms a white precipitate',
  '溶液变紫色': 'solution turns purple',
  '原子形式': 'atomic form',
  '单质形式': 'simple-substance form',
  '失去电子': 'loses electrons',
  '化合价升高': 'oxidation state increases',
  '一定生成气体': 'must produce a gas',
  '得到电子': 'gains electrons',
  '生成难溶物': 'forms an insoluble substance',
  '溶液颜色完全相同': 'solution colors are exactly the same',
  '反应物都是单质': 'all reactants are simple substances',
  '温度保持不变': 'temperature remains unchanged',
  '中性': 'neutral',
  '酸性': 'acidic',
  '碱性': 'basic',
  '自由移动的分子': 'freely moving molecules',
  '静止的原子核': 'stationary nuclei',
  '大量中子': 'many neutrons',
  '摄氏温度': 'Celsius temperature',
  '任意温标': 'any temperature scale',
  '只生成电子': 'only produces electrons',
  '加成反应': 'addition reaction',
  '取代反应': 'substitution reaction',
  '中和反应': 'neutralization reaction',
  '复分解反应': 'double displacement reaction',
  '生成沉淀': 'formation of a precipitate',
  '生成气体': 'formation of a gas',
  '生成水': 'formation of water',
  '生成单质铁一定发生': 'formation of elemental iron must occur',
  '离子形式': 'ionic form',
  '分子形式': 'molecular form',
  '元素符号形式': 'element-symbol form',
  '电子式': 'electron-dot formula',
  '自由移动的离子': 'freely moving ions',
  '大量分子': 'many molecules',
  '不动的原子': 'stationary atoms',
  '颜色变化': 'color change',
  '部分电离': 'partially ionizes',
  '完全不电离': 'does not ionize at all',
  '完全电离': 'completely ionizes',
  '只生成气体': 'only produces gas',
  '开尔文温度': 'Kelvin temperature',
  '活泼金属氧化物': 'active metal oxides',
  '酸性氧化物一定不能': 'acidic oxides definitely cannot',
  '稀有气体': 'noble gases',
  '非电解质': 'nonelectrolytes',
  '碳碳双键': 'carbon-carbon double bond',
  '酯基': 'ester group',
  '分子式': 'molecular formula',
  '结构式': 'structural formula',
  '物理性质一定相同': 'physical properties must be identical',
  '官能团一定相同': 'functional groups must be identical',
  '吸热反应': 'endothermic reaction',
  '放热反应': 'exothermic reaction',
  '反应物质量更小': 'reactants have smaller mass',
  '气体体积更小': 'gas volume is smaller',
  '加快': 'speeds up',
  '一定减慢': 'must slow down',
  '与温度无关': 'unrelated to temperature'
};

function hasHan(text) {
  return /[\u3400-\u9fff]/.test(String(text || ''));
}

function sanitizeEnglish(text, fallback) {
  const cleaned = String(text || '')
    .replace(/（\s*）/g, '( )')
    .replace(/[，。；：、]/g, ' ')
    .replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned && !hasHan(cleaned)) return cleaned;
  const stripped = cleaned.replace(/[\u3400-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped && /[A-Za-z0-9$\\]/.test(stripped) ? stripped : fallback;
}

function translateMathLikeText(text, fallback) {
  const exact = OPTION_TRANSLATIONS[String(text || '').trim()];
  if (exact) return exact;
  let next = String(text || '');
  const replacements = [
    [/第\s*(\d+)\s*个/g, 'case $1 '],
    [/第\s*(\d+)\s*组/g, 'case $1 '],
    [/数据/g, 'data'],
    [/已知/g, 'Given '],
    [/设/g, 'Let '],
    [/若/g, 'if '],
    [/则/g, 'then '],
    [/在/g, 'in '],
    [/中/g, ''],
    [/时/g, 'when '],
    [/通常/g, 'usually '],
    [/常见/g, 'common '],
    [/主要/g, 'mainly '],
    [/一定/g, 'must '],
    [/不包括/g, 'does not include'],
    [/包括/g, 'includes'],
    [/属于/g, 'belongs to'],
    [/发生/g, 'occurs'],
    [/达到/g, 'reaches'],
    [/平衡/g, 'equilibrium'],
    [/正反应速率/g, 'forward reaction rate'],
    [/逆反应速率/g, 'reverse reaction rate'],
    [/升高温度/g, 'increasing temperature'],
    [/方向移动/g, 'direction does the equilibrium shift'],
    [/反应速率/g, 'reaction rate'],
    [/案例/g, 'example'],
    [/离子方程式/g, 'ionic equation'],
    [/强酸强碱/g, 'strong acids and strong bases'],
    [/可溶性盐/g, 'soluble salts'],
    [/写成/g, 'written as'],
    [/实验/g, 'experiment'],
    [/混合/g, 'are mixed'],
    [/主要生成/g, 'mainly forms'],
    [/沉淀/g, 'precipitate'],
    [/物质/g, 'substance'],
    [/强电解质/g, 'strong electrolyte'],
    [/弱电解质/g, 'weak electrolyte'],
    [/水中/g, 'in water'],
    [/溶液导电性/g, 'solution conductivity'],
    [/关键看/g, 'depends on whether'],
    [/含有/g, 'contains'],
    [/气体状态分析/g, 'gas-state analysis'],
    [/理想气体状态方程/g, 'ideal gas equation'],
    [/密闭容器/g, 'closed container'],
    [/温度升高/g, 'temperature increases'],
    [/体积不变/g, 'volume remains constant'],
    [/气体压强/g, 'gas pressure'],
    [/使用/g, 'using'],
    [/温度应使用/g, 'temperature should be'],
    [/常见无机物/g, 'common inorganic substances'],
    [/碳酸盐遇强酸/g, 'carbonate meets a strong acid'],
    [/产生/g, 'produces'],
    [/金属活动性/g, 'metal activity'],
    [/活泼金属与稀酸反应/g, 'active metals react with dilute acid'],
    [/氧化物/g, 'oxide'],
    [/能与水反应生成碱/g, 'can react with water to form a base'],
    [/有机物分类/g, 'organic compound classification'],
    [/烃类物质/g, 'hydrocarbons'],
    [/元素/g, 'elements'],
    [/官能团判断/g, 'functional group identification'],
    [/官能团/g, 'functional group'],
    [/通常写作/g, 'is usually written as'],
    [/互为同分异构体/g, 'are isomers'],
    [/说明它们具有相同的/g, 'means they have the same'],
    [/有机反应/g, 'organic reaction'],
    [/乙烯使溴水褪色/g, 'ethene decolorizes bromine water'],
    [/反应类型/g, 'reaction type'],
    [/条件下/g, 'under the condition that'],
    [/甲烷与氯气/g, 'methane and chlorine'],
    [/光照/g, 'light'],
    [/乙醇被氧化可生成乙醛/g, 'ethanol can be oxidized to ethanal'],
    [/下列/g, 'which of the following '],
    [/正确的是/g, 'is correct'],
    [/错误的是/g, 'is incorrect'],
    [/值为/g, 'has value'],
    [/等于/g, 'equals'],
    [/求/g, 'find '],
    [/函数/g, 'function'],
    [/集合/g, 'set'],
    [/定义域/g, 'domain'],
    [/值域/g, 'range'],
    [/单调递增/g, 'increasing'],
    [/单调递减/g, 'decreasing'],
    [/奇函数/g, 'odd function'],
    [/偶函数/g, 'even function'],
    [/图像/g, 'graph'],
    [/方程/g, 'equation'],
    [/不等式/g, 'inequality'],
    [/数列/g, 'sequence'],
    [/等差/g, 'arithmetic'],
    [/等比/g, 'geometric'],
    [/前/g, 'first '],
    [/项和/g, ' terms sum'],
    [/概率/g, 'probability'],
    [/平均数/g, 'mean'],
    [/中位数/g, 'median'],
    [/方差/g, 'variance'],
    [/直线/g, 'line'],
    [/圆/g, 'circle'],
    [/向量/g, 'vector'],
    [/复数/g, 'complex number'],
    [/物体/g, 'object'],
    [/速度/g, 'velocity'],
    [/加速度/g, 'acceleration'],
    [/力/g, 'force'],
    [/电流/g, 'current'],
    [/电压/g, 'voltage'],
    [/电阻/g, 'resistance'],
    [/功率/g, 'power'],
    [/物质的量/g, 'amount of substance'],
    [/摩尔质量/g, 'molar mass'],
    [/溶液/g, 'solution'],
    [/浓度/g, 'concentration'],
    [/氧化剂/g, 'oxidizing agent'],
    [/还原剂/g, 'reducing agent'],
    [/反应/g, 'reaction'],
    [/化学/g, 'chemical'],
    [/元素/g, 'element'],
    [/原子/g, 'atom'],
    [/离子/g, 'ion'],
    [/正确/g, 'correct'],
    [/可能/g, 'possible'],
    [/为/g, 'is ']
  ];
  replacements.forEach(([pattern, value]) => { next = next.replace(pattern, value); });
  return sanitizeEnglish(next, fallback);
}

function normalizePromptSource(text) {
  return String(text || '')
    .replace(/^【[^】]+】/, '')
    .replace(/^第\s*\d+\s*[题组]，?/, '')
    .trim();
}

function cleanMathTarget(value) {
  return String(value || '').replace(/=(?=\$$)/, '');
}

function translatePromptText(text, slug, fallback) {
  const source = normalizePromptSource(text);
  const patterns = [
    [/^若首项为 (.+?) 的数列 (.+?) 满足 (.+?)，则 (.+?)（ ）$/, ([, first, sequence, rule, target]) => `For the sequence ${sequence} with first term ${first} and satisfying ${rule}, find ${cleanMathTarget(target)}.`],
    [/^在等差数列 (\$[^$]+\$) 中 ?(\$[^$]+\$)，(\$[^$]+\$)，则 (\$[^$]+\$) 等于（ ）$/, ([, sequence, conditionA, conditionB, target]) => `In the arithmetic sequence ${sequence}, given ${conditionA} and ${conditionB}, find ${target}.`],
    [/^数列 (.+) 的一个通项公式是 (.+?)（ ）$/, ([, sequence, target]) => `For the sequence ${sequence}, one possible formula for ${cleanMathTarget(target)} is ( ).`],
    [/^数列 (.+) 的通项公式为 (.+?)（ ）$/, ([, sequence, target]) => `For the sequence ${sequence}, the formula for ${cleanMathTarget(target)} is ( ).`],
    [/^已知 (\$[^$]+\$) 为等比数列，且 (.+)，则 (\$[^$]+\$)=（ ）$/, ([, sequence, conditions, target]) => `Given ${sequence} is a geometric sequence and ${conditions}, find ${target}.`],
    [/^等差数列 (\$[^$]+\$) 中，若 (.+)，则公差 (\$[^$]+\$) 的值为（ ）$/, ([, sequence, conditions, target]) => `In the arithmetic sequence ${sequence}, if ${conditions}, find the common difference ${target}.`],
    [/^设 (\$[^$]+\$) 为等差数列 (\$[^$]+\$) 的前 (\$[^$]+\$) 项和，已知 (.+)，则 (.+) 的值为（ ）$/, ([, sum, sequence, count, conditions, target]) => `Let ${sum} be the sum of the first ${count} terms of the arithmetic sequence ${sequence}. Given ${conditions}, find ${target}.`],
    [/^已知数列 (\$[^$]+\$) 为等差数列，若 (.+)，则 (.+) 为（ ）$/, ([, sequence, conditions, target]) => `Given ${sequence} is an arithmetic sequence, if ${conditions}, find ${target}.`],
    [/^等比数列 (\$[^$]+\$) 满足 (.+)，则 (.+)=（ ）$/, ([, sequence, conditions, target]) => `For the geometric sequence ${sequence}, if ${conditions}, find ${target}.`],
    [/^已知等差数列 (\$[^$]+\$) 满足 (.+)，则下列各式正确的是（ ）$/, ([, sequence, conditions]) => `Given the arithmetic sequence ${sequence} satisfies ${conditions}, which statement is correct?`],
    [/^已知 (\$[^$]+\$) 是等差数列 (\$[^$]+\$) 的前 (\$[^$]+\$) 项和，若 (.+)，则 (.+)=（ ）$/, ([, sum, sequence, count, conditions, target]) => `Given ${sum} is the sum of the first ${count} terms of the arithmetic sequence ${sequence}, if ${conditions}, find ${target}.`],
    [/^已知等差数列 (\$[^$]+\$) 满足 (.+)，则 (.+) 等于（ ）$/, ([, sequence, conditions, target]) => `Given the arithmetic sequence ${sequence} satisfies ${conditions}, find ${target}.`],
    [/^已知等差数列 (\$[^$]+\$) 的第二项和第三项分别为 (.+)，则第 (\$[^$]+\$) 项的值为（ ）$/, ([, sequence, values, term]) => `In the arithmetic sequence ${sequence}, the second and third terms are ${values}, respectively. Find the ${term} term.`],
    [/^已知数列 (\$[^$]+\$) 为等比数列，(.+)，则 (.+)=（ ）$/, ([, sequence, conditions, target]) => `Given ${sequence} is a geometric sequence and ${conditions}, find ${target}.`],
    [/^在等差数列 (\$[^$]+\$) 中，(.+)，则 (.+)=（ ）$/, ([, sequence, conditions, target]) => `In the arithmetic sequence ${sequence}, if ${conditions}, find ${target}.`],
    [/^已知等差数列 (\$[^$]+\$) 的前 (\$[^$]+\$) 项和为 (\$[^$]+\$)，(.+)，则 (.+)=（ ）$/, ([, sequence, count, sum, conditions, target]) => `For the arithmetic sequence ${sequence}, let ${sum} be the sum of the first ${count} terms. Given ${conditions}, find ${target}.`],
    [/^已知等差数列 (\$[^$]+\$) 中，(.+)，则前 (\$[^$]+\$) 项和 (\$[^$]+\$) 的值为（ ）$/, ([, sequence, conditions, count, sum]) => `In the arithmetic sequence ${sequence}, given ${conditions}, find the sum ${sum} of the first ${count} terms.`],
    [/^已知数列 (.+)，则它的通项公式可能是（ ）$/, ([, sequence]) => `Given the sequence ${sequence}, which formula could be its general term?`],
    [/^从 5 名同学中选 2 名参加比赛，共有（ ）种选法$/, () => 'How many ways are there to choose 2 students from 5 students to participate in a competition?'],
    [/^从 4 个不同元素中取 2 个排成一列，共有（ ）种排列$/, () => 'How many permutations are there when choosing 2 of 4 distinct elements and arranging them in a row?'],
    [/^从 (\$[^$]+\$) 中取两个不同数字组成两位数，共有（ ）个(?:（变式 \d+）)?$/, ([, digits]) => `How many two-digit numbers can be formed by choosing two different digits from ${digits}?`],
    [/^点 (\$[^$]+\$) 位于（ ）$/, ([, point]) => `The point ${point} is located ( ).`],

    [/^质量为 (\$[^$]+\$) 的物体受到合力 (\$[^$]+\$)，加速度为（ ）$/, ([, mass, force]) => `An object with mass ${mass} is acted on by a net force of ${force}. Its acceleration is ( ).`],
    [/^物体由静止做匀加速直线运动，加速度 (\$[^$]+\$)，(\$[^$]+\$) 后速度为（ ）$/, ([, acceleration, time]) => `An object starts from rest and moves with uniform acceleration ${acceleration}. After ${time}, its speed is ( ).`],
    [/^线速度 (\$[^$]+\$)、半径 (\$[^$]+\$) 的匀速圆周运动，向心加速度为（ ）$/, ([, speed, radius]) => `For uniform circular motion with linear speed ${speed} and radius ${radius}, the centripetal acceleration is ( ).`],
    [/^质量 (\$[^$]+\$)、速度 (\$[^$]+\$) 的物体动量大小为（ ）$/, ([, mass, speed]) => `An object with mass ${mass} and speed ${speed} has momentum magnitude ( ).`],
    [/^恒力 (\$[^$]+\$) 沿位移方向作用 (\$[^$]+\$)，做功为（ ）$/, ([, force, distance]) => `A constant force ${force} acts along a displacement of ${distance}. The work done is ( ).`],
    [/^物体所受合力为零时，下列说法正确的是（ ）$/, () => 'When the net force on an object is zero, which statement is correct?'],
    [/^电阻 (\$[^$]+\$) 中电流为 (\$[^$]+\$)，两端电压为（ ）$/, ([, resistance, current]) => `A resistor of ${resistance} carries a current of ${current}. The voltage across it is ( ).`],
    [/^电荷量 (\$[^$]+\$) 的正电荷在 (\$[^$]+\$) 的电场中受力大小为（ ）$/, ([, charge, field]) => `A positive charge of ${charge} in an electric field of ${field} experiences an electric force of magnitude ( ).`],
    [/^闭合线圈中磁通量增大时，感应电流磁场的趋势是（ ）$/, () => 'When the magnetic flux through a closed coil increases, the induced-current magnetic field tends to ( ).'],
    [/^通电导线在磁场中受力方向通常可用（ ）判断$/, () => 'The force direction on a current-carrying wire in a magnetic field is usually determined by ( ).'],
    [/^两个相同电阻并联后，总电阻与单个电阻相比（ ）$/, () => 'After two identical resistors are connected in parallel, the total resistance is ( ) compared with one resistor.'],
    [/^带正电粒子垂直进入匀强磁场做圆周运动时，洛伦兹力（ ）$/, () => 'When a positively charged particle enters a uniform magnetic field perpendicularly and moves in a circle, the Lorentz force ( ).'],
    [/^机械波频率 (\$[^$]+\$)、波长 (\$[^$]+\$)，波速为（ ）$/, ([, frequency, wavelength]) => `A mechanical wave has frequency ${frequency} and wavelength ${wavelength}. Its wave speed is ( ).`],
    [/^波速不变时，频率增大，波长将（ ）$/, () => 'If wave speed is constant and frequency increases, the wavelength will ( ).'],
    [/^平面镜成像的性质是（ ）$/, () => 'The image formed by a plane mirror is ( ).'],
    [/^光从空气斜射入水中，折射角通常（ ）入射角$/, () => 'When light enters water obliquely from air, the angle of refraction is usually ( ) the angle of incidence.'],
    [/^双缝干涉主要说明光具有（ ）$/, () => 'Double-slit interference mainly shows that light has ( ).'],
    [/^只有横波才有的典型现象是（ ）$/, () => 'A typical phenomenon that only transverse waves have is ( ).'],
    [/^(\$[^$]+\$)，(\$[^$]+\$)，(\$[^$]+\$)，则吸热量 (\$[^$]+\$)=（ ）$/, ([, c, mass, deltaT, heat]) => `Given ${c}, ${mass}, and ${deltaT}, the absorbed heat ${heat} is ( ).`],
    [/^一定质量理想气体等温膨胀时，压强通常（ ）$/, () => 'When a fixed amount of ideal gas expands isothermally, its pressure usually ( ).'],
    [/^温度升高从微观上表示分子平均动能（ ）$/, () => 'Microscopically, a temperature increase means the average molecular kinetic energy ( ).'],
    [/^气体吸热 (\$[^$]+\$)，同时对外做功 (\$[^$]+\$)，内能变化为（ ）$/, ([, heat, work]) => `A gas absorbs ${heat} and does ${work} of work on the surroundings. The change in internal energy is ( ).`],
    [/^扩散现象说明分子（ ）$/, () => 'Diffusion shows that molecules ( ).'],
    [/^理想气体状态方程中的温度应使用（ ）$/, () => 'The temperature in the ideal gas equation should be ( ).'],
    [/^光电效应说明光具有（ ）$/, () => 'The photoelectric effect shows that light has ( ).'],
    [/^发生光电效应时，入射光频率必须（ ）极限频率$/, () => 'For the photoelectric effect to occur, the incident light frequency must be ( ) the threshold frequency.'],
    [/^原子从高能级跃迁到低能级时会（ ）$/, () => 'When an atom transitions from a higher energy level to a lower one, it will ( ).'],
    [/^放射性元素经过 (\d+) 个半衰期后，剩余量为原来的（ ）$/, ([, count]) => `After a radioactive element goes through ${count} half-lives, the remaining amount is ( ) of the original amount.`],
    [/^核反应释放能量常与（ ）有关$/, () => 'Energy released in nuclear reactions is often related to ( ).'],
    [/^若入射光频率低于极限频率，即使增大光强也（ ）$/, () => 'If the incident light frequency is below the threshold frequency, increasing the light intensity still ( ).'],

    [/^质量为 18 g 的水的物质的量约为（ ）$/, () => 'The amount of substance in 18 g of water is approximately ( ).'],
    [/^下列属于纯净物的是（ ）$/, () => 'Which of the following is a pure substance?'],
    [/^决定元素种类的是原子的（ ）$/, () => 'The type of element is determined by the atom\'s ( ).'],
    [/^氯化钠晶体中主要存在的化学键是（ ）$/, () => 'The main chemical bond in sodium chloride crystals is ( ).'],
    [/^硫酸根离子的符号是（ ）$/, () => 'The symbol for the sulfate ion is ( ).'],
    [/^下列变化一定属于化学变化的是（ ）$/, () => 'Which of the following changes must be a chemical change?'],
    [/^同一周期从左到右，主族元素原子半径通常（ ）$/, () => 'Across the same period from left to right, the atomic radius of main-group elements usually ( ).'],
    [/^配平方程式时必须遵守的核心原则是（ ）$/, () => 'The core principle for balancing a chemical equation is ( ).'],
    [/^(\$[^$]+\$) 中碳元素的化合价是（ ）$/, ([, formula]) => `The oxidation state of carbon in ${formula} is ( ).`],
    [/^从电离角度看，酸在水溶液中能电离出的共同阳离子是（ ）$/, () => 'From the ionization perspective, the common cation produced by acids in aqueous solution is ( ).'],
    [/^氧化还原反应的本质是（ ）$/, () => 'The essence of a redox reaction is ( ).'],
    [/^某元素化合价升高，说明该元素（ ）$/, () => 'If an element\'s oxidation state increases, the element ( ).'],
    [/^向 (\$[^$]+\$) 溶液中加入 (\$[^$]+\$) 溶液，主要现象是（ ）$/, ([, solutionA, solutionB]) => `When ${solutionB} solution is added to ${solutionA} solution, the main observation is ( ).`],
    [/^书写离子方程式时，强酸、强碱和可溶性盐通常应写成（ ）$/, () => 'When writing ionic equations, strong acids, strong bases, and soluble salts are usually written in ( ).'],
    [/^可逆反应达到化学平衡时，正、逆反应速率（ ）$/, () => 'When a reversible reaction reaches chemical equilibrium, the forward and reverse reaction rates are ( ).'],
    [/^其他条件不变时，升高温度通常会使化学反应速率（ ）$/, () => 'With other conditions unchanged, raising temperature usually makes the reaction rate ( ).'],
    [/^对于吸热可逆反应，升高温度时平衡一般向（ ）$/, () => 'For an endothermic reversible reaction, raising temperature generally shifts the equilibrium toward ( ).'],
    [/^氧化剂在反应中通常（ ）$/, () => 'In a reaction, an oxidizing agent usually ( ).'],
    [/^下列通常是离子反应发生条件的是（ ）$/, () => 'Which of the following is usually a condition for an ionic reaction to occur?'],
    [/^加入催化剂后，下列说法正确的是（ ）$/, () => 'After adding a catalyst, which statement is correct?'],
    [/^物质的量浓度 (\$[^$]+\$) 与溶质物质的量 (\$[^$]+\$)、溶液体积 (\$[^$]+\$) 的关系是（ ）$/, ([, concentration, amount, volume]) => `What is the relationship among molar concentration ${concentration}, solute amount ${amount}, and solution volume ${volume}?`],
    [/^常温下某溶液 (\$[^$]+\$)，该溶液呈（ ）$/, ([, ph]) => `At room temperature, a solution has ${ph}. The solution is ( ).`],
    [/^下列物质在水溶液中属于强电解质的是（ ）$/, () => 'Which of the following substances is a strong electrolyte in aqueous solution?'],
    [/^电解质溶液能导电，主要因为溶液中存在（ ）$/, () => 'An electrolyte solution conducts electricity mainly because it contains ( ).'],
    [/^一定量理想气体在温度不变时，压强增大，则体积（ ）$/, () => 'For a fixed amount of ideal gas at constant temperature, if pressure increases, the volume ( ).'],
    [/^使用理想气体状态方程 (\$[^$]+\$) 时，温度应使用（ ）$/, ([, equation]) => `When using the ideal gas equation ${equation}, the temperature should be ( ).`],
    [/^将一定量溶液加水稀释后，保持不变的是溶质的（ ）$/, () => 'After diluting a solution with water, the solute\'s ( ) remains unchanged.'],
    [/^弱电解质在水溶液中的电离特点是（ ）$/, () => 'The ionization characteristic of a weak electrolyte in aqueous solution is ( ).'],
    [/^0\.1 mol\/L 的盐酸中，忽略水的电离，(\$[^$]+\$) 浓度约为（ ）$/, ([, ion]) => `In 0.1 mol/L hydrochloric acid, ignoring water ionization, the concentration of ${ion} is approximately ( ).`],
    [/^定容容器中一定量理想气体温度升高时，压强通常（ ）$/, () => 'For a fixed amount of ideal gas in a constant-volume container, when temperature rises, pressure usually ( ).'],
    [/^碳酸盐与足量稀盐酸反应通常会产生（ ）$/, () => 'A carbonate reacting with excess dilute hydrochloric acid usually produces ( ).'],
    [/^烃类化合物一定含有的元素是（ ）$/, () => 'Hydrocarbons must contain which elements?'],
    [/^醇类常见的官能团是（ ）$/, () => 'The common functional group of alcohols is ( ).'],
    [/^实验室闻未知气体气味时，正确操作是（ ）$/, () => 'When smelling an unknown gas in the laboratory, the correct operation is ( ).'],
    [/^分离不溶性固体和液体的常用方法是（ ）$/, () => 'The common method for separating an insoluble solid from a liquid is ( ).'],
    [/^乙烯能使溴水褪色，主要发生的是（ ）$/, () => 'Ethene decolorizes bromine water mainly because it undergoes ( ).'],
    [/^工业流程中循环利用未反应物，主要目的是（ ）$/, () => 'In an industrial process, recycling unreacted materials mainly aims to ( ).'],
    [/^检验溶液中 (\$[^$]+\$) 时，常加入硝酸酸化的（ ）$/, ([, ion]) => `To test for ${ion} in solution, a nitric-acidified reagent is commonly added: ( ).`],
    [/^互为同分异构体的有机物一定具有相同的（ ）$/, () => 'Organic compounds that are isomers must have the same ( ).'],
    [/^活泼金属与稀盐酸反应通常生成盐和（ ）$/, () => 'Active metals reacting with dilute hydrochloric acid usually produce a salt and ( ).']
  ];

  for (const [pattern, format] of patterns) {
    const match = source.match(pattern);
    if (match) return sanitizeEnglish(format(match), fallback);
  }

  const translated = translateMathLikeText(source, fallback)
    .replace(/\s+is\s+\( \)$/g, ' is ( ).')
    .replace(/\s+\(\s*\)$/g, ' ( ).')
    .replace(/\s+([?.])/g, '$1');
  if (!hasHan(translated) && translated !== fallback && /[A-Za-z]/.test(translated)) {
    return translated.endsWith('.') || translated.endsWith('?') ? translated : `${translated}.`;
  }
  return fallback;
}

function englishTags(tags, topicTitle) {
  const mapped = (Array.isArray(tags) ? tags : [])
    .map((tag) => EN_TAGS[tag] || Object.entries(EN_TAGS).find(([zh]) => String(tag).includes(zh))?.[1] || '')
    .filter(Boolean);
  return Array.from(new Set(mapped.length ? mapped : [topicTitle.toLowerCase(), 'core concept']));
}

function englishQuestionLocalization(item, slug, index) {
  const topicTitle = EN_TOPICS[slug]?.[0] || 'Targeted Practice';
  const tags = englishTags(item.knowledgeTags, topicTitle);
  const promptFallback = `Question ${index + 1}: Use the given formulas and conditions for ${topicTitle.toLowerCase()} to choose the correct option.`;
  const prompt = translatePromptText(item.prompt, slug, promptFallback);
  const options = LETTERS.map((id) => {
    const option = item.options.find((candidate) => candidate.id === id) || { id, text: '' };
    return { id, text: translateMathLikeText(option.text, `Option ${id}`) };
  });
  return {
    en: {
      difficulty: index < 8 ? 'Core' : index < 15 ? 'Medium' : 'Advanced',
      prompt,
      options,
      explanation: [
        `Knowledge point: ${tags.join(', ')}.`,
        `Analyze the conditions in the question and compare them with choices A-D.`,
        `The correct answer is ${item.correctAnswer}. Review the related rule, formula, or definition before moving to the next question.`
      ].join('\n'),
      knowledgeTags: tags
    }
  };
}

function englishTopicLocalization(slug, moduleName, title, description, displayData) {
  const [enTitle, enDescription] = EN_TOPICS[slug] || [translateMathLikeText(title, title), translateMathLikeText(description, description)];
  return {
    en: {
      module: EN_MODULES[moduleName] || translateMathLikeText(moduleName, moduleName),
      title: enTitle,
      description: enDescription,
      overview: displayData.overview
        ? `This topic summarizes the core ideas for ${enTitle.toLowerCase()} before a short CSCA targeted practice session.`
        : undefined,
      focusItems: [
        `Recognize the core definitions and formulas for ${enTitle.toLowerCase()}.`,
        'Practice common single-choice patterns.',
        'Review mistakes before returning to a full mock exam.'
      ],
      studyAdvice: 'Start with accuracy, read the explanation after each attempt, then use a timed mock exam to check pacing.',
      difficultyLabel: 'Core',
      frequencyLabel: 'Topic practice',
      relatedResources: displayData.relatedResources
    }
  };
}

function options(correctText, distractors, correctIndex) {
  const pool = [...distractors];
  return LETTERS.map((id, index) => ({ id, text: index === correctIndex ? correctText : pool.shift() }));
}

function question(prompt, correctText, distractors, explanation, tags, index) {
  const correctIndex = index % 4;
  const correctAnswer = LETTERS[correctIndex];
  return {
    prompt,
    options: options(correctText, distractors, correctIndex),
    correctAnswer,
    explanation: /故选\s*[A-D]/.test(explanation) ? explanation : `${explanation}\n故选 ${correctAnswer}。`,
    knowledgeTags: tags
  };
}

function difficultyForQuestion(subjectId, index) {
  if (subjectId === 'math' || subjectId === 'physics' || subjectId === 'chemistry') {
    if (index < 6) return '基础';
    if (index < 14) return '中等';
    if (index < 18) return '较难';
    return '挑战';
  }
  return index < 4 ? '较易' : index < 8 ? '中等' : '提高';
}

function questionCountForTopic(topicSlug) {
  if (topicSlug === 'math-function-basic') return 20;
  if (topicSlug === 'math-function') return 20;
  if (topicSlug === 'math-sequence') return 20;
  if (topicSlug.startsWith('math-')) return 20;
  if (topicSlug.startsWith('physics-')) return 20;
  if (topicSlug.startsWith('chemistry-')) return 20;
  return 10;
}

function buildLayeredMathQuestion(moduleName, topicTitle, topicSlug, index) {
  const n = index + 1;
  const tag = topicTitle;
  const pick = (variants) =>
    index < variants.length ? variants[index]() : buildLayeredMathBackHalf(moduleName, topicTitle, topicSlug, index);

  if (['math-function-basic', 'math-function', 'math-sequence'].includes(topicSlug)) {
    return null;
  }

  if (topicSlug === 'math-calculus') {
    const variants = [
      () => question('函数 $f(x)=x^3-3x^2+2$ 的导函数为（ ）', '$3x^2-6x$', ['$3x^2-3x$', '$x^2-6x$', '$3x-6$'], '【知识点】导数运算\n【分析】逐项求导即可。\n【详解】$(x^3)\'=3x^2$，$(-3x^2)\'=-6x$，常数项导数为 0，所以 $f\'(x)=3x^2-6x$。', [moduleName, tag, '导数运算'], index),
      () => question('曲线 $y=x^2+2x$ 在点 $x=1$ 处的切线斜率为（ ）', '$4$', ['$2$', '$3$', '$5$'], '【知识点】导数的几何意义\n【分析】切线斜率等于导数值。\n【详解】$y\'=2x+2$，代入 $x=1$ 得 $k=4$。', [moduleName, tag, '切线斜率'], index),
      () => question('函数 $f(x)=x^3-3x$ 的单调递增区间是（ ）', '$(-\\infty,-1)\\cup(1,+\\infty)$', ['$(-1,1)$', '$(-\\infty,1)$', '$(-1,+\\infty)$'], '【知识点】导数与单调性\n【分析】求导并判断导数符号。\n【详解】$f\'(x)=3x^2-3=3(x-1)(x+1)$，当 $x<-1$ 或 $x>1$ 时 $f\'(x)>0$，函数递增。', [moduleName, tag, '单调区间'], index),
      () => question('函数 $f(x)=x^2-4x+5$ 的最小值为（ ）', '$1$', ['$-1$', '$4$', '$5$'], '【知识点】导数求最值\n【分析】二次函数开口向上，也可令导数为 0。\n【详解】$f\'(x)=2x-4$，令 $f\'(x)=0$ 得 $x=2$，$f(2)=1$。', [moduleName, tag, '最值'], index),
      () => question('若 $f(x)=x^3+ax$ 在 $x=1$ 处切线斜率为 $5$，则 $a=$（ ）', '$2$', ['$1$', '$3$', '$5$'], '【知识点】导数与参数\n【分析】先求导，再利用指定点斜率建立方程。\n【详解】$f\'(x)=3x^2+a$，$f\'(1)=3+a=5$，所以 $a=2$。', [moduleName, tag, '参数', '切线斜率'], index),
      () => question('曲线 $y=x^2$ 在点 $(1,1)$ 处的切线方程是（ ）', '$y=2x-1$', ['$y=x+1$', '$y=2x+1$', '$y=x-1$'], '【知识点】切线方程\n【分析】先求斜率，再用点斜式。\n【详解】$y\'=2x$，在 $x=1$ 处斜率 $k=2$，切线为 $y-1=2(x-1)$，即 $y=2x-1$。', [moduleName, tag, '切线方程'], index),
      () => question('若 $f\'(x)=(x-2)(x+1)$，则 $x=2$ 附近函数 $f(x)$（ ）', '由减变增', ['由增变减', '一直递增', '一直递减'], '【知识点】极值判断\n【分析】观察导数在临界点两侧的符号。\n【详解】在 $x=2$ 左侧如 $x=0$，$f\'(x)<0$；右侧如 $x=3$，$f\'(x)>0$，所以由减变增。', [moduleName, tag, '极值'], index),
      () => question('$\\int_0^2 (2x+1)\\,dx=$（ ）', '$6$', ['$4$', '$5$', '$8$'], '【知识点】定积分计算\n【分析】先求原函数再代上下限。\n【详解】$\\int(2x+1)dx=x^2+x$，代入 $0,2$ 得 $4+2=6$。', [moduleName, tag, '定积分'], index),
      () => question('函数 $f(x)=x^3-3x^2+1$ 在 $x=2$ 处（ ）', '有极小值', ['有极大值', '无驻点', '导数不存在'], '【知识点】极值\n【分析】求导并看导数符号变化。\n【详解】$f\'(x)=3x^2-6x=3x(x-2)$，在 $x=2$ 左负右正，所以有极小值。', [moduleName, tag, '极值'], index),
      () => question('若 $f(x)=x^2$，则从 $x=1$ 到 $x=3$ 的平均变化率为（ ）', '$4$', ['$2$', '$3$', '$8$'], '【知识点】平均变化率\n【分析】平均变化率为 $\\frac{f(3)-f(1)}{3-1}$。\n【详解】$\\frac{9-1}{2}=4$。', [moduleName, tag, '平均变化率'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-plane-geometry') {
    const variants = [
      () => question('过点 $A(1,2)$，$B(5,8)$ 的直线斜率为（ ）', '$\\frac32$', ['$\\frac23$', '$6$', '$4$'], '【知识点】斜率\n【分析】斜率 $k=\\frac{y_2-y_1}{x_2-x_1}$。\n【详解】$k=\\frac{8-2}{5-1}=\\frac64=\\frac32$。', [moduleName, tag, '斜率'], index),
      () => question('线段 $AB$ 的端点为 $A(-1,3)$，$B(5,-1)$，其中点坐标为（ ）', '$(2,1)$', ['$(4,2)$', '$(3,-2)$', '$(-3,2)$'], '【知识点】中点坐标\n【分析】横纵坐标分别取平均。\n【详解】中点为 $(\\frac{-1+5}{2},\\frac{3-1}{2})=(2,1)$。', [moduleName, tag, '中点坐标'], index),
      () => question('圆 $(x-2)^2+(y+1)^2=9$ 的圆心和半径分别为（ ）', '$(2,-1),3$', ['$(-2,1),3$', '$(2,-1),9$', '$(-2,-1),3$'], '【知识点】圆的标准方程\n【分析】标准式为 $(x-a)^2+(y-b)^2=r^2$。\n【详解】圆心为 $(2,-1)$，半径为 $3$。', [moduleName, tag, '圆的方程'], index),
      () => question('与直线 $2x-y+3=0$ 平行的直线斜率为（ ）', '$2$', ['$-2$', '$\\frac12$', '$-\\frac12$'], '【知识点】平行直线\n【分析】化为斜截式。\n【详解】$2x-y+3=0$ 化为 $y=2x+3$，斜率为 2，平行直线斜率相同。', [moduleName, tag, '平行直线'], index),
      () => question('点 $P(3,4)$ 到原点的距离为（ ）', '$5$', ['$7$', '$25$', '$1$'], '【知识点】距离公式\n【分析】使用两点距离公式。\n【详解】$OP=\\sqrt{3^2+4^2}=5$。', [moduleName, tag, '距离公式'], index),
      () => question('直线 $y=-\\frac12x+1$ 与直线 $y=2x-3$ 的位置关系是（ ）', '垂直', ['平行', '重合', '无法判断'], '【知识点】垂直直线\n【分析】两直线斜率乘积为 $-1$ 时垂直。\n【详解】$(-\\frac12)\\times2=-1$，所以两直线垂直。', [moduleName, tag, '垂直直线'], index),
      () => question('过点 $(1,2)$ 且斜率为 $3$ 的直线方程是（ ）', '$y-2=3(x-1)$', ['$y+2=3(x-1)$', '$y-1=3(x-2)$', '$y=3x+2$'], '【知识点】点斜式\n【分析】点斜式为 $y-y_0=k(x-x_0)$。\n【详解】代入点 $(1,2)$ 和斜率 3，得 $y-2=3(x-1)$。', [moduleName, tag, '直线方程'], index),
      () => question('直线 $x+y-4=0$ 与坐标轴围成三角形的面积为（ ）', '$8$', ['$4$', '$12$', '$16$'], '【知识点】直线截距\n【分析】求出横纵截距。\n【详解】横截距为 4，纵截距为 4，面积 $=\\frac12\\times4\\times4=8$。', [moduleName, tag, '截距', '面积'], index),
      () => question('圆 $x^2+y^2=25$ 与 $x$ 轴正半轴的交点为（ ）', '$(5,0)$', ['$(-5,0)$', '$(0,5)$', '$(25,0)$'], '【知识点】圆与坐标轴\n【分析】令 $y=0$，再取正半轴。\n【详解】$x^2=25$，$x=5$ 或 $-5$，正半轴取 $(5,0)$。', [moduleName, tag, '圆的方程'], index),
      () => question('若点 $A(1,m)$，$B(3,5)$ 所在直线斜率为 $2$，则 $m=$（ ）', '$1$', ['$0$', '$2$', '$3$'], '【知识点】斜率与参数\n【分析】由斜率公式列方程。\n【详解】$\\frac{5-m}{3-1}=2$，所以 $5-m=4$，$m=1$。', [moduleName, tag, '参数', '斜率'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-solid-vector') {
    const variants = [
      () => question('$\\vec a=(2,-1)$，$\\vec b=(3,4)$，则 $\\vec a+\\vec b=$（ ）', '$(5,3)$', ['$(1,5)$', '$(6,-4)$', '$(5,-5)$'], '【知识点】向量加法\n【分析】坐标分别相加。\n【详解】$(2+3,-1+4)=(5,3)$。', [moduleName, tag, '向量加法'], index),
      () => question('$\\vec a=(1,2)$，$\\vec b=(3,-1)$，则 $\\vec a\\cdot\\vec b=$（ ）', '$1$', ['$5$', '$-1$', '$6$'], '【知识点】数量积\n【分析】对应坐标乘积求和。\n【详解】$1\\times3+2\\times(-1)=1$。', [moduleName, tag, '数量积'], index),
      () => question('向量 $(6,8)$ 的模长为（ ）', '$10$', ['$14$', '$100$', '$2$'], '【知识点】模长\n【分析】$|\\vec a|=\\sqrt{x^2+y^2}$。\n【详解】$\\sqrt{6^2+8^2}=10$。', [moduleName, tag, '模长'], index),
      () => question('若 $\\vec a=(2,3)$，$\\vec b=(4,6)$，则 $\\vec a$ 与 $\\vec b$（ ）', '平行', ['垂直', '夹角为 $60^\\circ$', '模长相等'], '【知识点】共线向量\n【分析】若一个向量是另一个的倍数，则平行。\n【详解】$\\vec b=2\\vec a$，所以两向量平行。', [moduleName, tag, '平行向量'], index),
      () => question('若 $\\vec a=(1,2)$，$\\vec b=(2,-1)$，则两向量夹角为（ ）', '$90^\\circ$', ['$0^\\circ$', '$45^\\circ$', '$180^\\circ$'], '【知识点】垂直向量\n【分析】数量积为 0 时垂直。\n【详解】$1\\times2+2\\times(-1)=0$，所以夹角为 $90^\\circ$。', [moduleName, tag, '垂直向量'], index),
      () => question('若 $\\vec a=(x,2)$ 与 $\\vec b=(3,6)$ 平行，则 $x=$（ ）', '$1$', ['$2$', '$3$', '$6$'], '【知识点】向量平行与参数\n【分析】平行时坐标成比例。\n【详解】$(3,6)=3(1,2)$，所以 $(x,2)$ 应为 $(1,2)$，得 $x=1$。', [moduleName, tag, '参数', '平行向量'], index),
      () => question('若 $|\\vec a|=3$，$|\\vec b|=4$，夹角为 $60^\\circ$，则 $\\vec a\\cdot\\vec b=$（ ）', '$6$', ['$12$', '$7$', '$0$'], '【知识点】数量积定义\n【分析】$\\vec a\\cdot\\vec b=|a||b|\\cos\\theta$。\n【详解】$3\\times4\\times\\frac12=6$。', [moduleName, tag, '数量积', '夹角'], index),
      () => question('若 $\\vec a=(1,-2)$，则 $-3\\vec a=$（ ）', '$(-3,6)$', ['$(3,-6)$', '$(-3,-6)$', '$(1,6)$'], '【知识点】向量数乘\n【分析】每个坐标都乘以 $-3$。\n【详解】$-3(1,-2)=(-3,6)$。', [moduleName, tag, '数乘向量'], index),
      () => question('若 $\\vec a+\\vec b=(5,1)$，$\\vec a=(2,4)$，则 $\\vec b=$（ ）', '$(3,-3)$', ['$(7,5)$', '$(-3,3)$', '$(3,5)$'], '【知识点】向量减法\n【分析】$\\vec b=(\\vec a+\\vec b)-\\vec a$。\n【详解】$(5,1)-(2,4)=(3,-3)$。', [moduleName, tag, '向量减法'], index),
      () => question('向量 $\\vec a=(2,1)$ 在 $\\vec b=(4,2)$ 方向上的关系是（ ）', '同向平行', ['反向平行', '垂直', '不共线'], '【知识点】向量方向\n【分析】判断是否为正倍数。\n【详解】$\\vec b=2\\vec a$，倍数为正，所以同向平行。', [moduleName, tag, '向量方向'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-complex') {
    const variants = [
      () => question('复数 $z=3-4i$ 的模为（ ）', '$5$', ['$7$', '$25$', '$1$'], '【知识点】复数模\n【分析】$|a+bi|=\\sqrt{a^2+b^2}$。\n【详解】$|3-4i|=\\sqrt{3^2+(-4)^2}=5$。', [moduleName, tag, '复数模'], index),
      () => question('$(2+i)+(1-3i)=$（ ）', '$3-2i$', ['$3+4i$', '$1-4i$', '$2-3i$'], '【知识点】复数加法\n【分析】实部、虚部分别相加。\n【详解】$(2+1)+(1-3)i=3-2i$。', [moduleName, tag, '复数加法'], index),
      () => question('$(1+i)^2=$（ ）', '$2i$', ['$2$', '$1+i$', '$-2i$'], '【知识点】复数乘法\n【分析】展开后用 $i^2=-1$。\n【详解】$(1+i)^2=1+2i+i^2=2i$。', [moduleName, tag, '复数乘法'], index),
      () => question('复数 $2+3i$ 的共轭复数是（ ）', '$2-3i$', ['$-2+3i$', '$3+2i$', '$-2-3i$'], '【知识点】共轭复数\n【分析】共轭复数实部不变，虚部变号。\n【详解】$2+3i$ 的共轭复数为 $2-3i$。', [moduleName, tag, '共轭复数'], index),
      () => question('若 $z=1-i$，则 $z\\bar z=$（ ）', '$2$', ['$0$', '$1-i$', '$-2i$'], '【知识点】共轭与模\n【分析】$z\\bar z=|z|^2$。\n【详解】$|1-i|^2=1^2+(-1)^2=2$。', [moduleName, tag, '共轭复数', '复数模'], index),
      () => question('$\\frac{1}{1+i}=$（ ）', '$\\frac{1-i}{2}$', ['$\\frac{1+i}{2}$', '$1-i$', '$-i$'], '【知识点】复数除法\n【分析】分母实数化。\n【详解】$\\frac1{1+i}\\cdot\\frac{1-i}{1-i}=\\frac{1-i}{2}$。', [moduleName, tag, '复数除法'], index),
      () => question('若复数 $z=a+2i$ 是纯虚数，则 $a=$（ ）', '$0$', ['$2$', '$-2$', '$1$'], '【知识点】纯虚数\n【分析】纯虚数要求实部为 0，虚部不为 0。\n【详解】实部 $a=0$。', [moduleName, tag, '纯虚数'], index),
      () => question('$i^{2026}=$（ ）', '$-1$', ['$1$', '$i$', '$-i$'], '【知识点】虚数单位周期\n【分析】$i$ 的幂以 4 为周期。\n【详解】$2026\\div4$ 余 2，所以 $i^{2026}=i^2=-1$。', [moduleName, tag, '虚数单位'], index),
      () => question('若 $(a+bi)+(2-i)=5+3i$，则 $a+b=$（ ）', '$7$', ['$5$', '$6$', '$8$'], '【知识点】复数相等\n【分析】实部与虚部分别相等。\n【详解】$a+2=5$ 得 $a=3$；$b-1=3$ 得 $b=4$，所以 $a+b=7$。', [moduleName, tag, '复数相等'], index),
      () => question('复数 $z=1+\\sqrt3 i$ 的辐角主值可为（ ）', '$\\frac{\\pi}{3}$', ['$\\frac{\\pi}{6}$', '$\\frac{2\\pi}{3}$', '$-\\frac{\\pi}{3}$'], '【知识点】复数几何意义\n【分析】点 $(1,\\sqrt3)$ 在第一象限，且 $\\tan\\theta=\\sqrt3$。\n【详解】故 $\\theta=\\frac{\\pi}{3}$。', [moduleName, tag, '复数几何意义'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-solid-geometry') {
    const variants = [
      () => question('棱长为 $3$ 的正方体体积是（ ）', '$27$', ['$9$', '$18$', '$54$'], '【知识点】正方体体积\n【分析】正方体体积 $V=a^3$。\n【详解】$V=3^3=27$。', [moduleName, tag, '正方体体积'], index),
      () => question('棱长为 $4$ 的正方体表面积是（ ）', '$96$', ['$64$', '$48$', '$16$'], '【知识点】正方体表面积\n【分析】表面积 $S=6a^2$。\n【详解】$S=6\\times4^2=96$。', [moduleName, tag, '正方体表面积'], index),
      () => question('半径为 $2$，高为 $5$ 的圆柱体积为（ ）', '$20\\pi$', ['$10\\pi$', '$40\\pi$', '$4\\pi$'], '【知识点】圆柱体积\n【分析】圆柱体积 $V=\\pi r^2h$。\n【详解】$V=\\pi\\times2^2\\times5=20\\pi$。', [moduleName, tag, '圆柱体积'], index),
      () => question('底面积为 $12$，高为 $6$ 的棱锥体积为（ ）', '$24$', ['$72$', '$36$', '$18$'], '【知识点】锥体体积\n【分析】锥体体积 $V=\\frac13Sh$。\n【详解】$V=\\frac13\\times12\\times6=24$。', [moduleName, tag, '棱锥体积'], index),
      () => question('半径为 $3$ 的球体积为（ ）', '$36\\pi$', ['$9\\pi$', '$27\\pi$', '$108\\pi$'], '【知识点】球体积\n【分析】球体积 $V=\\frac43\\pi r^3$。\n【详解】$V=\\frac43\\pi\\times3^3=36\\pi$。', [moduleName, tag, '球体积'], index),
      () => question('一个圆柱底面半径扩大为原来的 2 倍，高不变，则体积变为原来的（ ）', '$4$ 倍', ['$2$ 倍', '$8$ 倍', '不变'], '【知识点】体积变化\n【分析】圆柱体积与半径平方成正比。\n【详解】半径变为 2 倍，$r^2$ 变为 4 倍，因此体积变为 4 倍。', [moduleName, tag, '圆柱体积', '比例'], index),
      () => question('正方体的体对角线长为 $3\\sqrt3$，则棱长为（ ）', '$3$', ['$\\sqrt3$', '$9$', '$6$'], '【知识点】空间对角线\n【分析】正方体体对角线 $d=a\\sqrt3$。\n【详解】$a\\sqrt3=3\\sqrt3$，得 $a=3$。', [moduleName, tag, '空间对角线'], index),
      () => question('长方体长、宽、高分别为 $2,3,6$，其体对角线长为（ ）', '$7$', ['$11$', '$\\sqrt{11}$', '$6$'], '【知识点】长方体体对角线\n【分析】体对角线 $d=\\sqrt{a^2+b^2+c^2}$。\n【详解】$d=\\sqrt{2^2+3^2+6^2}=\\sqrt{49}=7$。', [moduleName, tag, '空间距离'], index),
      () => question('若一个球的表面积为 $16\\pi$，则其半径为（ ）', '$2$', ['$4$', '$1$', '$8$'], '【知识点】球表面积\n【分析】球表面积 $S=4\\pi r^2$。\n【详解】$4\\pi r^2=16\\pi$，得 $r^2=4$，$r=2$。', [moduleName, tag, '球体表面积'], index),
      () => question('圆锥底面半径为 $3$，高为 $4$，则母线长为（ ）', '$5$', ['$7$', '$12$', '$\\sqrt7$'], '【知识点】圆锥母线\n【分析】母线、半径、高构成直角三角形。\n【详解】$l=\\sqrt{3^2+4^2}=5$。', [moduleName, tag, '圆锥'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-coordinate-geometry') {
    const variants = [
      () => question('空间点 $A(1,2,3)$，$B(4,6,3)$ 的距离为（ ）', '$5$', ['$7$', '$25$', '$4$'], '【知识点】空间距离\n【分析】使用三维距离公式。\n【详解】$AB=\\sqrt{(4-1)^2+(6-2)^2+(3-3)^2}=5$。', [moduleName, tag, '空间距离'], index),
      () => question('$A(1,2,3)$，$B(5,0,7)$ 的中点坐标是（ ）', '$(3,1,5)$', ['$(6,2,10)$', '$(4,-2,4)$', '$(2,1,3)$'], '【知识点】空间中点\n【分析】三个坐标分别取平均。\n【详解】中点为 $(3,1,5)$。', [moduleName, tag, '空间中点'], index),
      () => question('空间向量 $\\overrightarrow{AB}$，$A(2,-1,3)$，$B(5,4,1)$，则 $\\overrightarrow{AB}=$（ ）', '$(3,5,-2)$', ['$(7,3,4)$', '$(-3,-5,2)$', '$(5,4,1)$'], '【知识点】空间向量坐标\n【分析】终点坐标减起点坐标。\n【详解】$(5-2,4-(-1),1-3)=(3,5,-2)$。', [moduleName, tag, '空间向量'], index),
      () => question('点 $P(2,-3,4)$ 关于 $xOy$ 平面对称的点为（ ）', '$(2,-3,-4)$', ['$(-2,3,4)$', '$(2,3,4)$', '$(-2,-3,4)$'], '【知识点】空间对称\n【分析】关于 $xOy$ 平面对称时 $z$ 坐标变号。\n【详解】对称点为 $(2,-3,-4)$。', [moduleName, tag, '空间对称'], index),
      () => question('球面 $(x-1)^2+(y+2)^2+(z-3)^2=25$ 的半径为（ ）', '$5$', ['$25$', '$3$', '$1$'], '【知识点】球面方程\n【分析】标准方程右侧是 $r^2$。\n【详解】$r^2=25$，故 $r=5$。', [moduleName, tag, '球面方程'], index),
      () => question('若点 $P(a,2,3)$ 到原点距离为 $\\sqrt{14}$，且 $a>0$，则 $a=$（ ）', '$1$', ['$2$', '$3$', '$9$'], '【知识点】空间距离与参数\n【分析】由距离公式建立方程。\n【详解】$a^2+2^2+3^2=14$，得 $a^2=1$，又 $a>0$，所以 $a=1$。', [moduleName, tag, '参数', '空间距离'], index),
      () => question('点 $(0,4,0)$ 位于（ ）', '$y$ 轴上', ['$x$ 轴上', '$z$ 轴上', '$xOy$ 平面外'], '【知识点】空间点位置\n【分析】只有 $y$ 坐标非零时在 $y$ 轴上。\n【详解】该点 $x=0,z=0$，故在 $y$ 轴上。', [moduleName, tag, '空间点坐标'], index),
      () => question('空间向量 $(1,2,2)$ 的模长为（ ）', '$3$', ['$5$', '$9$', '$\\sqrt5$'], '【知识点】空间向量模\n【分析】模长为坐标平方和开方。\n【详解】$\\sqrt{1^2+2^2+2^2}=3$。', [moduleName, tag, '空间向量模'], index),
      () => question('若 $A(1,0,0)$，$B(0,1,0)$，$C(0,0,1)$，则 $AB$ 与 $AC$ 的夹角余弦为（ ）', '$\\frac12$', ['$0$', '$-\\frac12$', '$1$'], '【知识点】空间向量夹角\n【分析】用数量积公式。\n【详解】$\\overrightarrow{AB}=(-1,1,0)$，$\\overrightarrow{AC}=(-1,0,1)$，数量积为 1，模长均为 $\\sqrt2$，余弦为 $\\frac{1}{2}$。', [moduleName, tag, '空间向量夹角'], index),
      () => question('点 $P(1,2,3)$ 到 $xOy$ 平面的距离为（ ）', '$3$', ['$1$', '$2$', '$\\sqrt{14}$'], '【知识点】点到坐标平面距离\n【分析】到 $xOy$ 平面的距离等于 $|z|$。\n【详解】$|3|=3$。', [moduleName, tag, '点到平面距离'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-inequality') {
    const variants = [
      () => question('$2x-3>5$ 的解集为（ ）', '$x>4$', ['$x<4$', '$x>1$', '$x<1$'], '【知识点】一元一次不等式\n【分析】移项再除以正数。\n【详解】$2x>8$，所以 $x>4$。', [moduleName, tag, '一元一次不等式'], index),
      () => question('$-3x+6\\ge0$ 的解集为（ ）', '$x\\le2$', ['$x\\ge2$', '$x<2$', '$x>-2$'], '【知识点】不等式性质\n【分析】除以负数时不等号改变方向。\n【详解】$-3x\\ge-6$，所以 $x\\le2$。', [moduleName, tag, '不等式性质'], index),
      () => question('$x^2-5x+6<0$ 的解集为（ ）', '$(2,3)$', ['$(-\\infty,2)\\cup(3,+\\infty)$', '$[2,3]$', '$(-3,-2)$'], '【知识点】二次不等式\n【分析】分解因式并判断符号。\n【详解】$(x-2)(x-3)<0$，解得 $2<x<3$。', [moduleName, tag, '二次不等式'], index),
      () => question('$|x-1|\\le2$ 的解集为（ ）', '$[-1,3]$', ['$(-1,3)$', '$(-\\infty,-1]\\cup[3,+\\infty)$', '$[1,2]$'], '【知识点】绝对值不等式\n【分析】$|u|\\le a$ 等价于 $-a\\le u\\le a$。\n【详解】$-2\\le x-1\\le2$，所以 $-1\\le x\\le3$。', [moduleName, tag, '绝对值不等式'], index),
      () => question('$\\frac{x-2}{x+1}>0$ 的解集为（ ）', '$(-\\infty,-1)\\cup(2,+\\infty)$', ['$(-1,2)$', '$(-\\infty,2)$', '$(-1,+\\infty)$'], '【知识点】分式不等式\n【分析】分子分母同号时分式为正。\n【详解】临界点为 $-1,2$，符号分析得 $(-\\infty,-1)\\cup(2,+\\infty)$。', [moduleName, tag, '分式不等式'], index),
      () => question('不等式组 $x>1$，$x\\le4$ 的解集为（ ）', '$(1,4]$', ['$[1,4)$', '$(-\\infty,1)\\cup(4,+\\infty)$', '$(1,4)$'], '【知识点】不等式组\n【分析】同时满足两个条件，取交集。\n【详解】解集为 $(1,4]$。', [moduleName, tag, '不等式组'], index),
      () => question('若关于 $x$ 的不等式 $x+a>3$ 的解集为 $x>5$，则 $a=$（ ）', '$-2$', ['$2$', '$8$', '$-8$'], '【知识点】参数不等式\n【分析】由 $x>3-a$ 与给定解集比较。\n【详解】$3-a=5$，所以 $a=-2$。', [moduleName, tag, '参数'], index),
      () => question('$x^2-4x+4\\ge0$ 的解集为（ ）', '$\\mathbb{R}$', ['$x\\ne2$', '$x>2$', '$x<2$'], '【知识点】完全平方不等式\n【分析】完全平方恒非负。\n【详解】$x^2-4x+4=(x-2)^2\\ge0$ 对一切实数成立。', [moduleName, tag, '完全平方'], index),
      () => question('若 $a>b$，则下列一定正确的是（ ）', '$a+2>b+2$', ['$-a>-b$', '$a^2>b^2$', '$\\frac1a<\\frac1b$'], '【知识点】不等式性质\n【分析】同加同减不改变不等号方向。\n【详解】两边同加 2，仍有 $a+2>b+2$。', [moduleName, tag, '不等式性质'], index),
      () => question('$x^2-1\\ge0$ 的解集为（ ）', '$(-\\infty,-1]\\cup[1,+\\infty)$', ['$[-1,1]$', '$(-1,1)$', '$[1,+\\infty)$'], '【知识点】二次不等式\n【分析】$(x-1)(x+1)\\ge0$，开口向上，取两侧。\n【详解】解得 $x\\le-1$ 或 $x\\ge1$。', [moduleName, tag, '二次不等式'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-set') {
    const variants = [
      () => question('设 $A=\\{1,2,3\\}$，$B=\\{3,4,5\\}$，则 $A\\cap B=$（ ）', '$\\{3\\}$', ['$\\{1,2,4,5\\}$', '$\\{1,2,3,4,5\\}$', '$\\varnothing$'], '【知识点】交集\n【分析】交集是两个集合共有元素。\n【详解】共有元素只有 3。', [moduleName, tag, '交集'], index),
      () => question('设 $A=\\{1,2\\}$，$B=\\{2,3\\}$，则 $A\\cup B=$（ ）', '$\\{1,2,3\\}$', ['$\\{2\\}$', '$\\{1,3\\}$', '$\\varnothing$'], '【知识点】并集\n【分析】并集包含属于 A 或属于 B 的元素。\n【详解】合并去重得 $\\{1,2,3\\}$。', [moduleName, tag, '并集'], index),
      () => question('全集 $U=\\{1,2,3,4,5\\}$，$A=\\{2,4\\}$，则 $\\complement_U A=$（ ）', '$\\{1,3,5\\}$', ['$\\{2,4\\}$', '$\\{1,2,3,4,5\\}$', '$\\varnothing$'], '【知识点】补集\n【分析】补集是在全集中但不属于 A 的元素。\n【详解】划去 2、4，剩下 1、3、5。', [moduleName, tag, '补集'], index),
      () => question('若 $A=\\{x|x>1\\}$，$B=\\{x|x<4\\}$，则 $A\\cap B=$（ ）', '$(1,4)$', ['$(-\\infty,1)$', '$(4,+\\infty)$', '$(-\\infty,+\\infty)$'], '【知识点】集合与区间\n【分析】同时满足 $x>1$ 与 $x<4$。\n【详解】交集为 $(1,4)$。', [moduleName, tag, '区间交集'], index),
      () => question('若 $A\\subseteq B$，下列说法一定正确的是（ ）', '$A\\cup B=B$', ['$A\\cap B=B$', '$B\\subseteq A$', '$A=B$'], '【知识点】子集性质\n【分析】A 的元素都在 B 中。\n【详解】并集不会超出 B，所以 $A\\cup B=B$。', [moduleName, tag, '子集'], index),
      () => question('$A=\\{1,2,3,4\\}$，$B=\\{3,4,5\\}$，则 $A-B=$（ ）', '$\\{1,2\\}$', ['$\\{3,4\\}$', '$\\{5\\}$', '$\\{1,2,3,4,5\\}$'], '【知识点】差集\n【分析】$A-B$ 是属于 A 但不属于 B 的元素。\n【详解】去掉 A 中的 3、4，剩 $\\{1,2\\}$。', [moduleName, tag, '差集'], index),
      () => question('集合 $A$ 有 4 个元素，$B$ 有 5 个元素，$A\\cap B$ 有 2 个元素，则 $A\\cup B$ 有（ ）个元素', '$7$', ['$9$', '$6$', '$11$'], '【知识点】容斥原理\n【分析】$|A\\cup B|=|A|+|B|-|A\\cap B|$。\n【详解】$4+5-2=7$。', [moduleName, tag, '容斥原理'], index),
      () => question('集合 $\\{x|x^2=4\\}$ 可表示为（ ）', '$\\{-2,2\\}$', ['$\\{2\\}$', '$\\{-4,4\\}$', '$\\varnothing$'], '【知识点】描述法与列举法\n【分析】解方程后列出所有元素。\n【详解】$x^2=4$ 得 $x=\\pm2$。', [moduleName, tag, '集合表示法'], index),
      () => question('若 $A\\cap B=\\varnothing$，则 A 与 B（ ）', '没有公共元素', ['一定相等', '一定都是空集', '并集为空集'], '【知识点】空交集\n【分析】交集为空说明没有共同元素。\n【详解】$A\\cap B=\\varnothing$ 表示两个集合无公共元素。', [moduleName, tag, '交集'], index),
      () => question('若 $A=\\{1,2,a\\}$ 与 $B=\\{1,2,3\\}$ 相等，则 $a=$（ ）', '$3$', ['$1$', '$2$', '$4$'], '【知识点】集合相等\n【分析】集合相等要求元素完全相同。\n【详解】A 中第三个元素必须为 3。', [moduleName, tag, '集合相等'], index)
    ];
    return pick(variants);
  }

  if (topicSlug === 'math-probability') {
    const variants = [
      () => question('抛一枚均匀硬币 2 次，至少出现 1 次正面的概率为（ ）', '$\\frac34$', ['$\\frac12$', '$\\frac14$', '$1$'], '【知识点】对立事件\n【分析】用 1 减去一次正面都不出现的概率。\n【详解】两次都是反面的概率为 $\\frac14$，故至少一次正面概率为 $1-\\frac14=\\frac34$。', [moduleName, tag, '概率', '对立事件'], index),
      () => question('从 5 名同学中选 2 名参加比赛，共有（ ）种选法', '$10$', ['$20$', '$5$', '$7$'], '【知识点】组合\n【分析】只选人不排序，用组合数。\n【详解】$C_5^2=\\frac{5\\times4}{2}=10$。', [moduleName, tag, '组合'], index),
      () => question('从 4 个不同元素中取 2 个排成一列，共有（ ）种排列', '$12$', ['$6$', '$8$', '$16$'], '【知识点】排列\n【分析】取出并排序，用排列数。\n【详解】$A_4^2=4\\times3=12$。', [moduleName, tag, '排列'], index),
      () => question('数据 $2,4,4,6$ 的方差为（ ）', '$2$', ['$1$', '$4$', '$8$'], '【知识点】方差\n【分析】先求平均数，再求平方差平均。\n【详解】平均数为 4，方差 $=\\frac{(2-4)^2+0+0+(6-4)^2}{4}=2$。', [moduleName, tag, '方差'], index),
      () => question('一组数据 $1,2,2,5,10$ 的中位数为（ ）', '$2$', ['$1$', '$5$', '$4$'], '【知识点】中位数\n【分析】数据已从小到大排列，中间项为中位数。\n【详解】第 3 项是 2。', [moduleName, tag, '中位数'], index),
      () => question('袋中有 3 个红球、2 个白球，不放回取 2 个，恰好都是红球的概率为（ ）', '$\\frac{3}{10}$', ['$\\frac35$', '$\\frac{9}{25}$', '$\\frac12$'], '【知识点】不放回概率\n【分析】用组合数计算。\n【详解】总取法 $C_5^2=10$，取 2 个红球 $C_3^2=3$，概率 $\\frac3{10}$。', [moduleName, tag, '古典概型'], index),
      () => question('某班男生 12 人、女生 18 人，随机抽 1 人为女生的概率是（ ）', '$\\frac35$', ['$\\frac25$', '$\\frac23$', '$\\frac12$'], '【知识点】古典概型\n【分析】概率等于女生人数除以总人数。\n【详解】$\\frac{18}{12+18}=\\frac35$。', [moduleName, tag, '古典概型'], index),
      () => question('数据 $3,3,4,5,10$ 的众数是（ ）', '$3$', ['$4$', '$5$', '$10$'], '【知识点】众数\n【分析】出现次数最多的数据是众数。\n【详解】3 出现 2 次，最多。', [moduleName, tag, '众数'], index),
      () => question('甲、乙独立射击，命中概率分别为 $\\frac12$、$\\frac13$，两人都命中的概率是（ ）', '$\\frac16$', ['$\\frac56$', '$\\frac23$', '$\\frac13$'], '【知识点】独立事件\n【分析】独立事件同时发生概率相乘。\n【详解】$\\frac12\\times\\frac13=\\frac16$。', [moduleName, tag, '独立事件'], index),
      () => question('从数字 $1,2,3,4$ 中随机取一个数，取到偶数或大于 3 的概率是（ ）', '$\\frac12$', ['$\\frac34$', '$\\frac14$', '$1$'], '【知识点】并事件概率\n【分析】偶数集合为 $\\{2,4\\}$，大于 3 为 $\\{4\\}$，并集为 $\\{2,4\\}$。\n【详解】有利结果 2 个，总结果 4 个，概率 $\\frac12$。', [moduleName, tag, '并事件'], index)
    ];
    return pick(variants);
  }

  return buildLayeredMathBackHalf(moduleName, topicTitle, topicSlug, index);
}

function buildLayeredMathBackHalf(moduleName, topicTitle, topicSlug, index) {
  if (index < 10 || ['math-function-basic', 'math-function', 'math-sequence'].includes(topicSlug)) {
    return null;
  }
  const tag = topicTitle;
  const j = index - 10;
  const choose = (variants) => {
    const item = variants[j % variants.length]();
    if (j >= variants.length) {
      return { ...item, prompt: `${item.prompt}（变式 ${j + 1}）` };
    }
    return item;
  };

  if (topicSlug === 'math-calculus') {
    const variants = [
      () => question('若函数 $f(x)=x^3-3ax$ 在 $x=1$ 处有极值，则 $a=$（ ）', '$1$', ['$-1$', '$2$', '$3$'], '【知识点】导数与参数\n【分析】极值点处导数为 0。\n【详解】$f\'(x)=3x^2-3a$，由 $f\'(1)=0$ 得 $3-3a=0$，所以 $a=1$。', [moduleName, tag, '极值', '参数'], index),
      () => question('函数 $f(x)=x^3-6x^2+9x$ 在 $(0,3)$ 上（ ）', '先增后减', ['单调递增', '单调递减', '先减后增'], '【知识点】导数与单调性\n【分析】求导并分析符号变化。\n【详解】$f\'(x)=3x^2-12x+9=3(x-1)(x-3)$，在 $(0,1)$ 为正，在 $(1,3)$ 为负，所以先增后减。', [moduleName, tag, '单调性'], index),
      () => question('曲线 $y=x^3$ 在点 $(1,1)$ 处的切线方程为（ ）', '$y=3x-2$', ['$y=x$', '$y=3x+2$', '$y=x+2$'], '【知识点】切线方程\n【分析】先求导数斜率，再写点斜式。\n【详解】$y\'=3x^2$，在 $x=1$ 处斜率为 3，切线 $y-1=3(x-1)$，即 $y=3x-2$。', [moduleName, tag, '切线方程'], index),
      () => question('$\\int_1^3 x\\,dx=$（ ）', '$4$', ['$2$', '$3$', '$8$'], '【知识点】定积分\n【分析】用原函数 $\\frac{x^2}{2}$ 代上下限。\n【详解】$\\int_1^3x\\,dx=\\frac{3^2-1^2}{2}=4$。', [moduleName, tag, '定积分'], index),
      () => question('若 $f\'(x)=x^2-4$，则 $f(x)$ 的递减区间是（ ）', '$(-2,2)$', ['$(-\\infty,-2)$', '$(2,+\\infty)$', '$(-\\infty,+\\infty)$'], '【知识点】导数与单调性\n【分析】递减区间满足 $f\'(x)<0$。\n【详解】$x^2-4<0$，解得 $-2<x<2$。', [moduleName, tag, '单调区间'], index),
      () => question('函数 $f(x)=\\frac{1}{3}x^3-x$ 的极大值点横坐标是（ ）', '$-1$', ['$1$', '$0$', '$2$'], '【知识点】极值判断\n【分析】求导后判断导数符号。\n【详解】$f\'(x)=x^2-1$，临界点为 $\\pm1$；在 $x=-1$ 处导数由正变负，故为极大值点。', [moduleName, tag, '极值'], index),
      () => question('若 $f(x)=x^2+1$，则 $f\'(2)$ 表示（ ）', '曲线在 $x=2$ 处切线斜率', ['函数在 $x=2$ 处的函数值', '曲线面积', '函数零点'], '【知识点】导数意义\n【分析】导数的几何意义是切线斜率。\n【详解】$f\'(2)$ 表示曲线 $y=f(x)$ 在 $x=2$ 处的切线斜率。', [moduleName, tag, '导数意义'], index),
      () => question('函数 $f(x)=x^4$ 在 $x=0$ 处（ ）', '导数为 0 但不一定是极值判断的全部依据', ['导数不存在', '一定没有最小值', '一定单调递减'], '【知识点】导数与极值\n【分析】驻点需要结合函数形态或导数符号判断。\n【详解】$f\'(0)=0$，且 $x^4\\ge0$，这里是最小值点；这说明导数为 0 后还要继续判断。', [moduleName, tag, '驻点'], index),
      () => question('若 $s(t)=t^2+3t$ 表示位移，则 $t=2$ 时的瞬时速度为（ ）', '$7$', ['$4$', '$5$', '$10$'], '【知识点】导数应用\n【分析】瞬时速度是位移函数的导数。\n【详解】$v(t)=s\'(t)=2t+3$，所以 $v(2)=7$。', [moduleName, tag, '导数应用'], index),
      () => question('函数 $f(x)=x^3-3x+2$ 的一个零点附近，若用导数研究单调性，第一步通常是（ ）', '求 $f\'(x)$', ['直接猜零点', '只看常数项', '忽略定义域'], '【知识点】导数解题流程\n【分析】导数法研究单调性要先求导。\n【详解】先求 $f\'(x)=3x^2-3$，再分析符号与区间。', [moduleName, tag, '解题流程'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-inequality') {
    const variants = [
      () => question('关于 $x$ 的不等式 $x^2-2x+a>0$ 对一切实数恒成立，则 $a$ 的取值范围是（ ）', '$a>1$', ['$a\\ge1$', '$a<1$', '$a\\le1$'], '【知识点】二次不等式恒成立\n【分析】开口向上且判别式小于 0。\n【详解】$\\Delta=(-2)^2-4a=4-4a<0$，得 $a>1$。', [moduleName, tag, '恒成立', '参数'], index),
      () => question('若 $x>1$，则 $x+\\frac{1}{x}$ 的最小值为（ ）', '$2$', ['$1$', '$3$', '$4$'], '【知识点】基本不等式\n【分析】正数 $x$ 与 $\\frac1x$ 乘积为 1。\n【详解】$x+\\frac1x\\ge2\\sqrt{x\\cdot\\frac1x}=2$，当 $x=1$ 取等；在 $x>1$ 中可趋近 2。', [moduleName, tag, '基本不等式'], index),
      () => question('不等式 $x^2-4x+3\\le0$ 的整数解个数为（ ）', '$3$', ['$1$', '$2$', '$4$'], '【知识点】二次不等式\n【分析】先求区间，再数整数。\n【详解】$(x-1)(x-3)\\le0$，得 $1\\le x\\le3$，整数解为 1、2、3，共 3 个。', [moduleName, tag, '二次不等式', '整数解'], index),
      () => question('$|2x-1|>3$ 的解集为（ ）', '$(-\\infty,-1)\\cup(2,+\\infty)$', ['$(-1,2)$', '$[-1,2]$', '$(-\\infty,2)$'], '【知识点】绝对值不等式\n【分析】$|u|>a$ 等价于 $u>a$ 或 $u<-a$。\n【详解】$2x-1>3$ 或 $2x-1<-3$，得 $x>2$ 或 $x<-1$。', [moduleName, tag, '绝对值不等式'], index),
      () => question('若 $0<a<b$，下列一定正确的是（ ）', '$\\frac1a>\\frac1b$', ['$a^2>b^2$', '$-a>-b$', '$a-b>0$'], '【知识点】不等式性质\n【分析】正数取倒数后大小关系反向。\n【详解】$0<a<b$，所以 $\\frac1a>\\frac1b$。', [moduleName, tag, '不等式性质'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-probability') {
    const variants = [
      () => question('从 6 件产品中有 2 件次品，任取 2 件，恰有 1 件次品的概率为（ ）', '$\\frac{8}{15}$', ['$\\frac{2}{15}$', '$\\frac{1}{3}$', '$\\frac{7}{15}$'], '【知识点】组合概率\n【分析】总取法 $C_6^2$，恰有 1 件次品为 $C_2^1C_4^1$。\n【详解】概率 $=\\frac{2\\times4}{15}=\\frac{8}{15}$。', [moduleName, tag, '组合概率'], index),
      () => question('甲、乙独立完成任务的概率分别为 $\\frac12$、$\\frac34$，至少一人完成的概率为（ ）', '$\\frac78$', ['$\\frac38$', '$\\frac58$', '$\\frac14$'], '【知识点】独立事件与对立事件\n【分析】至少一人完成的对立事件是两人都未完成。\n【详解】$1-(1-\\frac12)(1-\\frac34)=1-\\frac18=\\frac78$。', [moduleName, tag, '独立事件'], index),
      () => question('数据 $1,3,5,7,9$ 的方差为（ ）', '$8$', ['$4$', '$5$', '$10$'], '【知识点】方差\n【分析】先求平均数，再求平方差平均。\n【详解】平均数为 5，方差 $=\\frac{16+4+0+4+16}{5}=8$。', [moduleName, tag, '方差'], index),
      () => question('从 $1,2,3,4,5$ 中取两个不同数字组成两位数，共有（ ）个', '$20$', ['$10$', '$25$', '$15$'], '【知识点】排列\n【分析】十位有 5 种，个位剩 4 种。\n【详解】共有 $5\\times4=20$ 个。', [moduleName, tag, '排列'], index),
      () => question('若事件 $A,B$ 互斥，$P(A)=0.3$，$P(B)=0.4$，则 $P(A\\cup B)=$（ ）', '$0.7$', ['$0.12$', '$0.1$', '$1$'], '【知识点】互斥事件\n【分析】互斥事件并的概率相加。\n【详解】$P(A\\cup B)=0.3+0.4=0.7$。', [moduleName, tag, '互斥事件'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-solid-geometry') {
    const a = j + 2;
    const variants = [
      () => question(`一个长方体的长、宽、高分别为 $${a}$、$${a + 1}$、$${a + 2}$，则体积为（ ）`, `$${a * (a + 1) * (a + 2)}$`, [`$${a + a + 1 + a + 2}$`, `$${2 * (a * (a + 1) + a * (a + 2) + (a + 1) * (a + 2))}$`, `$${a * (a + 1)}$`], '【知识点】长方体体积\n【分析】长方体体积等于长、宽、高的乘积。\n【详解】$V=abc$。', [moduleName, tag, '长方体体积'], index),
      () => question(`正方体棱长为 $${a}$，则它的体对角线长为（ ）`, `$${a}\\sqrt3$`, [`$${a}\\sqrt2$`, `$${3 * a}$`, `$${a * a}$`], '【知识点】正方体体对角线\n【分析】体对角线公式为 $a\\sqrt3$。\n【详解】三条互相垂直的棱构成空间直角三角形。', [moduleName, tag, '空间对角线'], index),
      () => question(`圆柱体积为 $${a * a * (a + 3)}\\pi$，底面半径为 $${a}$，则高为（ ）`, `$${a + 3}$`, [`$${a}$`, `$${a * a}$`, `$${a + 1}$`], '【知识点】圆柱体积反求\n【分析】由 $V=\\pi r^2h$ 反求高。\n【详解】$h=V/(\\pi r^2)$。', [moduleName, tag, '圆柱体积'], index),
      () => question(`若球半径从 $${a}$ 变为 $${2 * a}$，则球体积变为原来的（ ）`, '$8$ 倍', ['$2$ 倍', '$4$ 倍', '$16$ 倍'], '【知识点】球体积比例\n【分析】球体积与半径的三次方成正比。\n【详解】半径变为 2 倍，体积变为 $2^3=8$ 倍。', [moduleName, tag, '球体积', '比例'], index),
      () => question(`圆锥底面半径为 $${a}$，高为 $${a + 1}$，则体积为（ ）`, `$\\frac{${a * a * (a + 1)}\\pi}{3}$`, [`$${a * a * (a + 1)}\\pi$`, `$${2 * a * (a + 1)}\\pi$`, `$${a * (a + 1)}\\pi$`], '【知识点】圆锥体积\n【分析】圆锥体积为 $\\frac13\\pi r^2h$。\n【详解】代入半径和高即可。', [moduleName, tag, '圆锥体积'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-coordinate-geometry') {
    const a = j + 1;
    const variants = [
      () => question(`空间点 $A(${a},0,${a + 1})$，$B(${a + 2},2,${a + 1})$ 的距离为（ ）`, `$2\\sqrt2$`, ['$2$', '$4$', `$\\sqrt{${2 * a * a}}$`], '【知识点】空间距离\n【分析】使用三维距离公式。\n【详解】坐标差为 $(2,2,0)$，距离为 $\\sqrt{4+4}=2\\sqrt2$。', [moduleName, tag, '空间距离'], index),
      () => question(`点 $P(${a},-${a},${a + 2})$ 到 $xOy$ 平面的距离为（ ）`, `$${a + 2}$`, [`$${a}$`, `$${2 * a}` , `$\\sqrt{${a * a + a * a}}$`], '【知识点】点到坐标平面距离\n【分析】到 $xOy$ 平面的距离等于 $|z|$。\n【详解】该点 $z=${a + 2}$。', [moduleName, tag, '点到平面距离'], index),
      () => question(`若空间向量 $\\vec a=(${a},2,1)$，$\\vec b=(1,${a},2)$，则 $\\vec a\\cdot\\vec b=$（ ）`, `$${a + 2 * a + 2}$`, [`$${2 * a + 3}$`, `$${a * a + 2}$`, `$${a + 3}$`], '【知识点】空间向量数量积\n【分析】对应坐标乘积求和。\n【详解】$a\\cdot1+2\\cdot a+1\\cdot2=3a+2$。', [moduleName, tag, '空间向量'], index),
      () => question(`球面 $(x-${a})^2+(y+${a})^2+(z-1)^2=${(a + 1) ** 2}$ 的球心为（ ）`, `$(${a},-${a},1)$`, [`$(-${a},${a},-1)$`, `$(${a},${a},1)$`, '$(0,0,0)$'], '【知识点】球面方程\n【分析】标准式 $(x-p)^2+(y-q)^2+(z-r)^2=R^2$ 的球心是 $(p,q,r)$。\n【详解】逐项读出球心坐标。', [moduleName, tag, '球面方程'], index),
      () => question(`点 $(${a},0,0)$ 与 $yz$ 平面的距离为（ ）`, `$${a}$`, ['$0$', `$${2 * a}$`, `$${a * a}$`], '【知识点】点到坐标平面距离\n【分析】到 $yz$ 平面的距离等于 $|x|$。\n【详解】该点横坐标为 $a$，距离为 $a$。', [moduleName, tag, '坐标平面'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-plane-geometry') {
    const a = j + 2;
    const b = j + 5;
    const variants = [
      () => question(`过点 $(0,${a})$ 且与直线 $y=${b}x+1$ 平行的直线方程是（ ）`, `$y=${b}x+${a}$`, [`$y=${a}x+${b}$`, `$y=-${b}x+${a}$`, `$y=${b}x-${a}$`], '【知识点】平行直线\n【分析】平行直线斜率相同，再利用截距确定方程。\n【详解】所求直线斜率为已知直线斜率，且过 $y$ 轴点，所以方程为对应斜截式。', [moduleName, tag, '平行直线'], index),
      () => question(`若点 $P(${a},m)$ 到原点距离为 $${b}$，且 $m>0$，则 $m=$（ ）`, `$\\sqrt{${b * b - a * a}}$`, [`$${b - a}$`, `$${a + b}$`, `$\\sqrt{${a * a + b * b}}$`], '【知识点】距离公式与参数\n【分析】由 $OP^2=x^2+y^2$ 建立方程。\n【详解】$m^2=b^2-a^2$，结合 $m>0$ 取正根。', [moduleName, tag, '距离公式', '参数'], index),
      () => question(`圆心为 $(${a},-${a})$，半径为 $${j + 3}$ 的圆方程是（ ）`, `$(x-${a})^2+(y+${a})^2=${(j + 3) ** 2}$`, [`$(x+${a})^2+(y-${a})^2=${(j + 3) ** 2}$`, `$(x-${a})^2+(y+${a})^2=${j + 3}$`, `$x^2+y^2=${(j + 3) ** 2}$`], '【知识点】圆的标准方程\n【分析】圆心 $(p,q)$、半径 $r$ 的方程为 $(x-p)^2+(y-q)^2=r^2$。\n【详解】直接代入圆心和半径即可。', [moduleName, tag, '圆的方程'], index),
      () => question(`直线 $y=${a}x+1$ 与 $y=-\\frac{1}{${a}}x+2$ 的位置关系是（ ）`, '垂直', ['平行', '重合', '无法判断'], '【知识点】垂直直线\n【分析】两条直线斜率乘积为 $-1$ 时垂直。\n【详解】$a\\cdot(-\\frac1a)=-1$，所以垂直。', [moduleName, tag, '垂直直线'], index),
      () => question(`线段端点 $A(${a},${b})$、$B(${a + 4},${b - 2})$ 的中点是（ ）`, `$(${a + 2},${b - 1})$`, [`$(${2 * a + 4},${2 * b - 2})$`, `$(${a + 4},${b - 2})$`, `$(${a - 2},${b + 1})$`], '【知识点】中点坐标\n【分析】横纵坐标分别取平均。\n【详解】中点横坐标为 $a+2$，纵坐标为 $b-1$。', [moduleName, tag, '中点坐标'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-solid-vector') {
    const a = j + 1;
    const variants = [
      () => question(`若 $\\vec a=(${a},2)$，$\\vec b=(3,${a + 4})$，则 $\\vec a\\cdot\\vec b=$（ ）`, `$${a * 3 + 2 * (a + 4)}$`, [`$${a + a + 6}$`, `$${3 * a - 2 * (a + 4)}$`, `$${a * (a + 4)}$`], '【知识点】数量积\n【分析】对应坐标乘积求和。\n【详解】$\\vec a\\cdot\\vec b=x_1x_2+y_1y_2$。', [moduleName, tag, '数量积'], index),
      () => question(`若 $\\vec a=(${a},${2 * a})$ 与 $\\vec b=(1,k)$ 平行，则 $k=$（ ）`, '$2$', [`$${a}$`, `$${2 * a}$`, '$-2$'], '【知识点】平行向量\n【分析】平行向量坐标成比例。\n【详解】$(${a},${2 * a})=${a}(1,2)$，所以 $k=2$。', [moduleName, tag, '平行向量', '参数'], index),
      () => question(`向量 $(${a},${a + 1})$ 的模长平方为（ ）`, `$${a * a + (a + 1) * (a + 1)}$`, [`$${2 * a + 1}$`, `$${a * (a + 1)}$`, `$${(2 * a + 1) ** 2}$`], '【知识点】向量模长\n【分析】模长平方等于坐标平方和。\n【详解】$|\\vec a|^2=x^2+y^2$。', [moduleName, tag, '模长'], index),
      () => question(`若 $\\vec a=(2,${a})$，$\\vec b=(${a},-2)$，且两向量垂直，则 $a$ 应满足（ ）`, '$a$ 可为任意实数时不一定成立', ['$a=1$', '$a=2$', '$a=0$'], '【知识点】垂直向量\n【分析】垂直要求数量积为 0。\n【详解】数量积为 $2a+a(-2)=0$，该结构恒为 0，说明题中给出的形式本身保证垂直。', [moduleName, tag, '垂直向量'], index),
      () => question(`已知 $\\vec a+\\vec b=(${a + 4},${a - 1})$，$\\vec a=(${a},2)$，则 $\\vec b=$（ ）`, `$(4,${a - 3})$`, [`$(${2 * a + 4},${a + 1})$`, `$(-4,${3 - a})$`, `$(4,${a + 1})$`], '【知识点】向量减法\n【分析】$\\vec b=(\\vec a+\\vec b)-\\vec a$。\n【详解】坐标分别相减。', [moduleName, tag, '向量减法'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-complex') {
    const a = j + 2;
    const variants = [
      () => question(`复数 $z=${a}-${a + 1}i$ 的模为（ ）`, `$\\sqrt{${a * a + (a + 1) * (a + 1)}}$`, [`$${2 * a + 1}$`, `$${a * (a + 1)}$`, `$\\sqrt{${(2 * a + 1) ** 2}}$`], '【知识点】复数模\n【分析】$|a+bi|=\\sqrt{a^2+b^2}$。\n【详解】实部和虚部平方相加后开方。', [moduleName, tag, '复数模'], index),
      () => question(`$(1+${a}i)(1-${a}i)=$（ ）`, `$${1 + a * a}$`, [`$1-${a * a}$`, `$${2 * a}i$`, `$1+${a}i$`], '【知识点】复数乘法\n【分析】共轭复数相乘等于模长平方。\n【详解】$(1+ai)(1-ai)=1+a^2$。', [moduleName, tag, '复数乘法'], index),
      () => question(`若 $z=a+bi$，且 $z+\\bar z=8$，则 $a=$（ ）`, '$4$', ['$8$', '$2$', '$0$'], '【知识点】共轭复数\n【分析】$z+\\bar z=2a$。\n【详解】$2a=8$，所以 $a=4$。', [moduleName, tag, '共轭复数'], index),
      () => question(`$i^{${20 + j}}=$（ ）`, ['$1$', '$i$', '$-1$', '$-i$'][(20 + j) % 4], ['$2$', '$0$', '$1+i$'], '【知识点】虚数单位周期\n【分析】$i$ 的幂以 4 为周期。\n【详解】用指数除以 4 的余数判断。', [moduleName, tag, '虚数单位'], index),
      () => question(`若 $(x+2i)-(1-${a}i)=3+5i$，则 $x=$（ ）`, '$4$', ['$2$', '$3$', '$5$'], '【知识点】复数相等\n【分析】先化简，再比较实部。\n【详解】实部为 $x-1=3$，所以 $x=4$。', [moduleName, tag, '复数相等'], index)
    ];
    return choose(variants);
  }

  if (topicSlug === 'math-set') {
    const a = j + 2;
    const variants = [
      () => question(`设 $A=\\{x|${a - 1}<x<${a + 3}\\}$，$B=\\{x|x>${a}\\}$，则 $A\\cap B=$（ ）`, `$(${a},${a + 3})$`, [`$(${a - 1},${a})$`, `$(${a - 1},+\\infty)$`, `$(-\\infty,${a + 3})$`], '【知识点】区间交集\n【分析】同时满足两个条件，取公共部分。\n【详解】公共部分为大于左端限制且小于右端限制的区间。', [moduleName, tag, '交集', '区间'], index),
      () => question(`若 $A$ 有 ${a} 个元素，$B$ 有 ${a + 2} 个元素，$A\\cap B$ 有 2 个元素，则 $A\\cup B$ 有（ ）个元素`, `$${2 * a}$`, [`$${2 * a + 2}$`, `$${a + 2}$`, '$2$'], '【知识点】容斥原理\n【分析】$|A\\cup B|=|A|+|B|-|A\\cap B|$。\n【详解】结果为 $a+(a+2)-2=2a$。', [moduleName, tag, '容斥原理'], index),
      () => question(`集合 $\\{x|x^2=${a * a}\\}$ 可表示为（ ）`, `$\\{-${a},${a}\\}$`, [`$\\{${a}\\}$`, `$\\{-${a * a},${a * a}\\}$`, '$\\varnothing$'], '【知识点】集合表示法\n【分析】解方程并列举元素。\n【详解】$x^2=a^2$ 的解为 $x=\\pm a$。', [moduleName, tag, '集合表示法'], index),
      () => question(`若 $A\\subseteq B$ 且 $B\\subseteq A$，则（ ）`, '$A=B$', ['$A\\cap B=\\varnothing$', '$A\\cup B=\\varnothing$', '$A$ 一定为空集'], '【知识点】集合相等\n【分析】互为子集说明元素完全相同。\n【详解】由集合相等定义，$A=B$。', [moduleName, tag, '集合相等'], index),
      () => question(`设 $U=\\{1,2,3,4,5,6,7\\}$，$A=\\{2,4,6\\}$，则 $\\complement_U A$ 中元素个数为（ ）`, '$4$', ['$3$', '$5$', '$7$'], '【知识点】补集\n【分析】补集元素个数等于全集个数减去 A 的元素个数。\n【详解】$7-3=4$。', [moduleName, tag, '补集'], index)
    ];
    return choose(variants);
  }

  return null;
}

function buildExpandedMathQuestion(moduleName, topicTitle, topicSlug, index) {
  const n = index + 1;
  const tag = topicTitle;
  if (['math-function-basic', 'math-function', 'math-sequence'].includes(topicSlug)) {
    return null;
  }
  const layeredQuestion = buildLayeredMathQuestion(moduleName, topicTitle, topicSlug, index);
  if (layeredQuestion) return layeredQuestion;

  if (topicSlug === 'math-calculus') {
    const a = (n % 4) + 1;
    const x = (n % 5) + 1;
    const variants = [
      () => question(`函数 $f(x)=${a}x^3-2x$ 的导函数为（ ）`, `$${3 * a}x^2-2$`, [`$${a}x^2-2$`, `$${3 * a}x-2$`, `$${a}x^3-2$`], `【知识点】导数运算\n【分析】分别对幂函数项求导。\n【详解】$(${a}x^3)'=${3 * a}x^2$，$(-2x)'=-2$，所以 $f'(x)=${3 * a}x^2-2$。`, [moduleName, tag, '导数运算'], index),
      () => question(`若 $f'(x)=2x+${a}$，则曲线 $y=f(x)$ 在 $x=${x}$ 处切线斜率为（ ）`, `$${2 * x + a}$`, [`$${2 * x}$`, `$${x + a}$`, `$${2 * (x + a)}$`], `【知识点】导数的几何意义\n【分析】切线斜率等于该点处的导数值。\n【详解】$k=f'(${x})=2\\times${x}+${a}=${2 * x + a}$。`, [moduleName, tag, '切线斜率'], index),
      () => question(`函数 $f(x)=x^2-${2 * a}x+1$ 的极小值点横坐标为（ ）`, `$${a}$`, [`$${-a}$`, `$${2 * a}$`, `$1$`], `【知识点】二次函数与导数\n【分析】令导数为 0 求驻点。\n【详解】$f'(x)=2x-${2 * a}$，令 $f'(x)=0$，得 $x=${a}$；二次项系数为正，此处为极小值点。`, [moduleName, tag, '极值'], index),
      () => question(`定积分 $\\int_0^${a} ${x}\\,dt$ 的值为（ ）`, `$${a * x}$`, [`$${a + x}$`, `$${a * x / 2}$`, `$${x}$`], `【知识点】定积分的几何意义\n【分析】常数函数在区间上的积分等于矩形面积。\n【详解】$\\int_0^${a} ${x}\\,dt=${x}\\times(${a}-0)=${a * x}$。`, [moduleName, tag, '定积分'], index),
      () => question(`若 $f'(x)>0$ 在区间 $(1,4)$ 内恒成立，则 $f(x)$ 在该区间上（ ）`, '单调递增', ['单调递减', '先增后减', '一定为常数'], `【知识点】导数与单调性\n【分析】导数为正表示函数值随自变量增大而增大。\n【详解】在区间内 $f'(x)>0$，所以 $f(x)$ 单调递增。`, [moduleName, tag, '单调性'], index),
      () => question(`函数 $f(x)=x^3-3x$ 在 $x=1$ 处的导数值为（ ）`, '$0$', ['$-3$', '$1$', '$3$'], `【知识点】导数求值\n【分析】先求导，再代入。\n【详解】$f'(x)=3x^2-3$，所以 $f'(1)=3-3=0$。`, [moduleName, tag, '导数求值'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-plane-geometry') {
    const x1 = n;
    const y1 = n + 2;
    const x2 = n + 4;
    const y2 = n + 5;
    const r = (n % 5) + 2;
    const variants = [
      () => question(`点 $A(${x1},${y1})$ 与 $B(${x2},${y2})$ 的中点坐标为（ ）`, `$(${(x1 + x2) / 2},${(y1 + y2) / 2})$`, [`$(${x1 + x2},${y1 + y2})$`, `$(${x2 - x1},${y2 - y1})$`, `$(${x1},${y2})$`], `【知识点】中点坐标\n【分析】横、纵坐标分别取平均。\n【详解】中点为 $(${x1 + x2}\\div2,${y1 + y2}\\div2)=(${(x1 + x2) / 2},${(y1 + y2) / 2})$。`, [moduleName, tag, '中点坐标'], index),
      () => question(`过点 $A(${x1},${y1})$，$B(${x2},${y2})$ 的直线斜率为（ ）`, `$\\frac{3}{4}$`, ['$\\frac{4}{3}$', '$3$', '$4$'], `【知识点】直线斜率\n【分析】斜率 $k=\\frac{y_2-y_1}{x_2-x_1}$。\n【详解】$k=\\frac{${y2}-${y1}}{${x2}-${x1}}=\\frac{3}{4}$。`, [moduleName, tag, '斜率'], index),
      () => question(`圆 $(x-${x1})^2+(y-${y1})^2=${r * r}$ 的半径是（ ）`, `$${r}$`, [`$${r * r}$`, `$${2 * r}$`, `$${x1}$`], `【知识点】圆的标准方程\n【分析】$(x-a)^2+(y-b)^2=r^2$ 中半径为 $r$。\n【详解】方程右边为 ${r * r}=${r}^2$，故半径为 ${r}。`, [moduleName, tag, '圆的方程'], index),
      () => question(`直线 $y=${aText(2)}x+${n}$ 与直线 $y=2x-${n}$ 的位置关系是（ ）`, '平行', ['垂直', '重合', '相交且不垂直'], `【知识点】直线位置关系\n【分析】两条直线斜率相同且截距不同则平行。\n【详解】两条直线斜率都为 $2$，截距分别为 ${n} 和 -${n}，所以平行。`, [moduleName, tag, '平行直线'], index),
      () => question(`点 $P(${x1},${y1})$ 到原点距离的平方为（ ）`, `$${x1 * x1 + y1 * y1}$`, [`$${x1 + y1}$`, `$${x1 * y1}$`, `$${(x1 + y1) ** 2}$`], `【知识点】两点距离\n【分析】到原点距离平方为 $x^2+y^2$。\n【详解】$OP^2=${x1}^2+${y1}^2=${x1 * x1 + y1 * y1}$。`, [moduleName, tag, '距离公式'], index),
      () => question(`与直线 $y=3x+1$ 垂直的直线斜率为（ ）`, '$-\\frac{1}{3}$', ['$3$', '$\\frac{1}{3}$', '$-3$'], `【知识点】垂直直线斜率\n【分析】两直线垂直时斜率乘积为 $-1$。\n【详解】已知斜率为 $3$，垂直直线斜率为 $-\\frac{1}{3}$。`, [moduleName, tag, '垂直直线'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-solid-vector') {
    const ax = n;
    const ay = n + 1;
    const bx = 2;
    const by = n + 3;
    const variants = [
      () => question(`向量 $\\vec a=(${ax},${ay})$，$\\vec b=(${bx},${by})$，则 $\\vec a+\\vec b=$（ ）`, `$(${ax + bx},${ay + by})$`, [`$(${ax - bx},${ay - by})$`, `$(${ax * bx},${ay * by})$`, `$(${bx},${ay})$`], `【知识点】向量加法\n【分析】对应坐标分别相加。\n【详解】$\\vec a+\\vec b=(${ax}+${bx},${ay}+${by})=(${ax + bx},${ay + by})$。`, [moduleName, tag, '向量加法'], index),
      () => question(`向量 $\\vec a=(${ax},${ay})$，$\\vec b=(${bx},${by})$，则 $\\vec a\\cdot\\vec b=$（ ）`, `$${ax * bx + ay * by}$`, [`$${ax + ay + bx + by}$`, `$${ax * by - ay * bx}$`, `$${ax * bx}$`], `【知识点】数量积\n【分析】数量积等于对应坐标乘积之和。\n【详解】$\\vec a\\cdot\\vec b=${ax}\\times${bx}+${ay}\\times${by}=${ax * bx + ay * by}$。`, [moduleName, tag, '数量积'], index),
      () => question(`向量 $\\vec a=(3,4)$ 的模长为（ ）`, '$5$', ['$7$', '$25$', '$1$'], `【知识点】向量模长\n【分析】模长 $|\\vec a|=\\sqrt{x^2+y^2}$。\n【详解】$|\\vec a|=\\sqrt{3^2+4^2}=5$。`, [moduleName, tag, '模长'], index),
      () => question(`若 $\\vec a=(2,3)$，则 $2\\vec a=$（ ）`, '$(4,6)$', ['$(2,6)$', '$(4,3)$', '$(1,\\frac32)$'], `【知识点】向量数乘\n【分析】数乘向量时每个坐标同时乘该数。\n【详解】$2(2,3)=(4,6)$。`, [moduleName, tag, '数乘向量'], index),
      () => question(`若 $\\vec a=(1,2)$，$\\vec b=(2,4)$，则两向量（ ）`, '平行', ['垂直', '模长相等', '方向一定相反'], `【知识点】向量共线\n【分析】一个向量是另一个向量的数倍时，两向量平行。\n【详解】$\\vec b=2\\vec a$，所以两向量平行。`, [moduleName, tag, '平行向量'], index),
      () => question(`若 $\\vec a=(1,2)$，$\\vec b=(2,-1)$，则两向量夹角为（ ）`, '$90^\\circ$', ['$0^\\circ$', '$45^\\circ$', '$180^\\circ$'], `【知识点】垂直向量\n【分析】数量积为 0 时两向量垂直。\n【详解】$\\vec a\\cdot\\vec b=1\\times2+2\\times(-1)=0$，所以夹角为 $90^\\circ$。`, [moduleName, tag, '垂直向量'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-complex') {
    const a = n;
    const b = n + 2;
    const variants = [
      () => question(`复数 $z=${a}+${b}i$ 的虚部是（ ）`, `$${b}$`, [`$${a}$`, `$${a + b}$`, '$i$'], `【知识点】复数的代数形式\n【分析】$a+bi$ 中 $b$ 为虚部。\n【详解】$z=${a}+${b}i$，虚部是 ${b}。`, [moduleName, tag, '虚部'], index),
      () => question(`$(${a}+${b}i)+(${b}+${a}i)=$（ ）`, `$${a + b}+${a + b}i$`, [`$${a + b}$`, `$${a * b}i$`, `$${a - b}+${b - a}i$`], `【知识点】复数加法\n【分析】实部与实部相加，虚部与虚部相加。\n【详解】结果为 $${a + b}+${a + b}i$。`, [moduleName, tag, '复数加法'], index),
      () => question(`复数 $z=${a}+${b}i$ 的共轭复数为（ ）`, `$${a}-${b}i$`, [`$${a}+${b}i$`, `$-${a}+${b}i$`, `$${b}-${a}i$`], `【知识点】共轭复数\n【分析】共轭复数实部不变，虚部变号。\n【详解】$${a}+${b}i$ 的共轭复数是 $${a}-${b}i$。`, [moduleName, tag, '共轭复数'], index),
      () => question(`复数 $3+4i$ 的模为（ ）`, '$5$', ['$7$', '$25$', '$1$'], `【知识点】复数的模\n【分析】$|a+bi|=\\sqrt{a^2+b^2}$。\n【详解】$|3+4i|=\\sqrt{3^2+4^2}=5$。`, [moduleName, tag, '复数模'], index),
      () => question(`$(1+i)^2=$（ ）`, '$2i$', ['$2$', '$1+i$', '$-2i$'], `【知识点】复数乘法\n【分析】展开并利用 $i^2=-1$。\n【详解】$(1+i)^2=1+2i+i^2=2i$。`, [moduleName, tag, '复数乘法'], index),
      () => question(`若 $z=2-i$，则 $z\\bar z=$（ ）`, '$5$', ['$3$', '$2-i$', '$1$'], `【知识点】复数与共轭\n【分析】$z\\bar z=|z|^2$。\n【详解】$|2-i|^2=2^2+(-1)^2=5$。`, [moduleName, tag, '共轭复数', '复数模'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-solid-geometry') {
    const side = (n % 5) + 2;
    const radius = (n % 4) + 1;
    const height = n + 3;
    const variants = [
      () => question(`棱长为 ${side} 的正方体体积是（ ）`, `$${side ** 3}$`, [`$${side * side}$`, `$${6 * side * side}$`, `$${3 * side}$`], `【知识点】正方体体积\n【分析】正方体体积 $V=a^3$。\n【详解】$V=${side}^3=${side ** 3}$。`, [moduleName, tag, '正方体体积'], index),
      () => question(`棱长为 ${side} 的正方体表面积是（ ）`, `$${6 * side * side}$`, [`$${side ** 3}$`, `$${side * side}$`, `$${12 * side}$`], `【知识点】正方体表面积\n【分析】正方体有 6 个相同正方形面。\n【详解】$S=6a^2=6\\times${side}^2=${6 * side * side}$。`, [moduleName, tag, '正方体表面积'], index),
      () => question(`半径为 ${radius}、高为 ${height} 的圆柱体积是（ ）`, `$${radius * radius * height}\\pi$`, [`$${2 * radius * height}\\pi$`, `$${radius * height}\\pi$`, `$${radius * radius}\\pi$`], `【知识点】圆柱体积\n【分析】圆柱体积 $V=\\pi r^2h$。\n【详解】$V=\\pi\\times${radius}^2\\times${height}=${radius * radius * height}\\pi$。`, [moduleName, tag, '圆柱体积'], index),
      () => question(`底面积为 ${side * side}、高为 ${height} 的棱锥体积是（ ）`, `$${side * side * height / 3}$`, [`$${side * side * height}$`, `$${side * side + height}$`, `$${side * height}$`], `【知识点】棱锥体积\n【分析】锥体体积等于 $\\frac13$ 底面积乘高。\n【详解】$V=\\frac13\\times${side * side}\\times${height}=${side * side * height / 3}$。`, [moduleName, tag, '棱锥体积'], index),
      () => question(`球的表面积公式是（ ）`, '$S=4\\pi r^2$', ['$S=\\pi r^2$', '$S=2\\pi r$', '$S=\\pi r^2h$'], `【知识点】球体表面积\n【分析】记忆球的基本公式。\n【详解】球表面积为 $4\\pi r^2$，球体积为 $\\frac43\\pi r^3$。`, [moduleName, tag, '球体表面积'], index),
      () => question(`半径为 3 的球体积是（ ）`, '$36\\pi$', ['$9\\pi$', '$27\\pi$', '$12\\pi$'], `【知识点】球体积\n【分析】球体积 $V=\\frac43\\pi r^3$。\n【详解】$V=\\frac43\\pi\\times3^3=36\\pi$。`, [moduleName, tag, '球体积'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-coordinate-geometry') {
    const x1 = n;
    const y1 = n + 1;
    const z1 = n + 2;
    const x2 = n + 2;
    const y2 = n + 3;
    const z2 = n + 4;
    const variants = [
      () => question(`空间点 $A(${x1},${y1},${z1})$ 与 $B(${x2},${y2},${z2})$ 的中点坐标是（ ）`, `$(${(x1 + x2) / 2},${(y1 + y2) / 2},${(z1 + z2) / 2})$`, [`$(${x1 + x2},${y1 + y2},${z1 + z2})$`, `$(${x2 - x1},${y2 - y1},${z2 - z1})$`, `$(${x1},${y2},${z1})$`], `【知识点】空间中点坐标\n【分析】三个坐标分别取平均。\n【详解】中点坐标为 $(${(x1 + x2) / 2},${(y1 + y2) / 2},${(z1 + z2) / 2})$。`, [moduleName, tag, '空间中点'], index),
      () => question(`点 $P(${x1},${y1},${z1})$ 到原点距离的平方是（ ）`, `$${x1 * x1 + y1 * y1 + z1 * z1}$`, [`$${x1 + y1 + z1}$`, `$${x1 * y1 * z1}$`, `$${x1 * x1 + y1 * y1}$`], `【知识点】空间距离\n【分析】空间中到原点距离平方为 $x^2+y^2+z^2$。\n【详解】$OP^2=${x1}^2+${y1}^2+${z1}^2=${x1 * x1 + y1 * y1 + z1 * z1}$。`, [moduleName, tag, '空间距离'], index),
      () => question(`空间向量 $\\overrightarrow{AB}$，其中 $A(1,2,3)$，$B(4,6,8)$，则 $\\overrightarrow{AB}=$（ ）`, '$(3,4,5)$', ['$(5,8,11)$', '$(-3,-4,-5)$', '$(4,6,8)$'], `【知识点】空间向量坐标\n【分析】终点坐标减起点坐标。\n【详解】$\\overrightarrow{AB}=(4-1,6-2,8-3)=(3,4,5)$。`, [moduleName, tag, '空间向量'], index),
      () => question(`空间直角坐标系中，点 $P(2,-3,4)$ 关于 $xOy$ 平面对称的点为（ ）`, '$(2,-3,-4)$', ['$(-2,3,4)$', '$(2,3,4)$', '$(-2,-3,4)$'], `【知识点】空间点对称\n【分析】关于 $xOy$ 平面对称时，$x,y$ 不变，$z$ 变号。\n【详解】对称点为 $(2,-3,-4)$。`, [moduleName, tag, '空间对称'], index),
      () => question(`球面 $(x-1)^2+(y+2)^2+(z-3)^2=16$ 的球心是（ ）`, '$(1,-2,3)$', ['$(-1,2,-3)$', '$(1,2,3)$', '$(0,0,0)$'], `【知识点】球面方程\n【分析】球面标准方程为 $(x-a)^2+(y-b)^2+(z-c)^2=r^2$。\n【详解】球心为 $(1,-2,3)$。`, [moduleName, tag, '球面方程'], index),
      () => question(`空间点 $(0,0,5)$ 位于（ ）`, '$z$ 轴上', ['$x$ 轴上', '$y$ 轴上', '$xOy$ 平面内'], `【知识点】空间点位置\n【分析】当 $x=0,y=0$ 时点在 $z$ 轴上。\n【详解】点 $(0,0,5)$ 的前两个坐标为 0，因此在 $z$ 轴上。`, [moduleName, tag, '空间点坐标'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-inequality') {
    const a = n + 2;
    const b = n * 2 + 9;
    const answer = b - a;
    const variants = [
      () => question(`不等式 $x+${a}>${b}$ 的解集为（ ）`, `$x>${answer}$`, [`$x<${answer}$`, `$x\\ge${answer}$`, `$x\\le${answer}$`], `【知识点】一元一次不等式\n【分析】两边同时减去 ${a}。\n【详解】$x>${b}-${a}=${answer}$。`, [moduleName, tag, '一元一次不等式'], index),
      () => question(`不等式 $-2x<${2 * a}$ 的解集为（ ）`, `$x>-${a}$`, [`$x<-${a}$`, `$x>${a}$`, `$x<- ${a}$`], `【知识点】不等式性质\n【分析】两边除以负数，不等号方向改变。\n【详解】$-2x<${2 * a}$，两边除以 $-2$，得 $x>-${a}$。`, [moduleName, tag, '不等式性质'], index),
      () => question(`不等式 $x^2-5x+6<0$ 的解集为（ ）`, '$(2,3)$', ['$(-\\infty,2)\\cup(3,+\\infty)$', '$[2,3]$', '$(-3,-2)$'], `【知识点】二次不等式\n【分析】先分解因式，再看开口方向。\n【详解】$x^2-5x+6=(x-2)(x-3)$，开口向上，小于 0 在两根之间，即 $(2,3)$。`, [moduleName, tag, '二次不等式'], index),
      () => question(`不等式 $|x-2|<3$ 的解集为（ ）`, '$(-1,5)$', ['$(-\\infty,-1)\\cup(5,+\\infty)$', '$[-1,5]$', '$(2,5)$'], `【知识点】绝对值不等式\n【分析】$|u|<a$ 等价于 $-a<u<a$。\n【详解】$-3<x-2<3$，所以 $-1<x<5$。`, [moduleName, tag, '绝对值不等式'], index),
      () => question(`不等式组 $x>1$ 且 $x\\le4$ 的解集为（ ）`, '$(1,4]$', ['$[1,4)$', '$(-\\infty,1)\\cup(4,+\\infty)$', '$(1,4)$'], `【知识点】区间表示\n【分析】同时满足两个条件，取交集。\n【详解】$x>1$ 且 $x\\le4$ 表示 $(1,4]$。`, [moduleName, tag, '区间表示'], index),
      () => question(`分式不等式 $\\frac{x-1}{x+2}>0$ 的解集为（ ）`, '$(-\\infty,-2)\\cup(1,+\\infty)$', ['$(-2,1)$', '$(-\\infty,1)$', '$(-2,+\\infty)$'], `【知识点】分式不等式\n【分析】分子分母同号时分式为正，并排除分母为 0。\n【详解】临界点为 $-2,1$，符号分析得解集 $(-\\infty,-2)\\cup(1,+\\infty)$。`, [moduleName, tag, '分式不等式'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-set') {
    const u = [1, 2, 3, 4, 5, 6];
    const middle = (n % 4) + 2;
    const setA = [1, middle, 6];
    const complement = u.filter((value) => !setA.includes(value));
    const variants = [
      () => question(`设 $A=\\{1,2,${n + 2}\\}$，$B=\\{2,${n + 2},${n + 3}\\}$，则 $A\\cap B=$（ ）`, `$\\{2,${n + 2}\\}$`, [`$\\{1,${n + 3}\\}$`, `$\\{1,2,${n + 2},${n + 3}\\}$`, `$\\{${n + 3}\\}$`], `【知识点】交集\n【分析】交集保留两个集合共有的元素。\n【详解】共有元素为 $2$ 和 $${n + 2}$。`, [moduleName, tag, '交集'], index),
      () => question(`设 $A=\\{1,2,3\\}$，$B=\\{3,4,5\\}$，则 $A\\cup B=$（ ）`, '$\\{1,2,3,4,5\\}$', ['$\\{3\\}$', '$\\{1,2,4,5\\}$', '$\\{1,2,3\\}$'], `【知识点】并集\n【分析】并集包含属于 A 或属于 B 的所有元素。\n【详解】合并并去重得 $\\{1,2,3,4,5\\}$。`, [moduleName, tag, '并集'], index),
      () => question(`设全集 $U=\\{${u.join(',')}\\}$，$A=\\{${setA.join(',')}\\}$，则 $\\complement_U A=$（ ）`, `$\\{${complement.join(',')}\\}$`, [`$\\{1,6\\}$`, `$\\{${middle},6\\}$`, `$\\{${u.join(',')}\\}$`], `【知识点】补集\n【分析】补集是在全集中但不属于 A 的元素。\n【详解】从 U 中划去 A 的元素，剩下 $\\{${complement.join(',')}\\}$。`, [moduleName, tag, '补集'], index),
      () => question(`若 $A=\\{1,2\\}$，$B=\\{1,2,3\\}$，则下列关系正确的是（ ）`, '$A\\subseteq B$', ['$B\\subseteq A$', '$A=B$', '$A\\cap B=\\varnothing$'], `【知识点】子集\n【分析】A 中每个元素都在 B 中。\n【详解】$1,2$ 都属于 B，所以 $A\\subseteq B$。`, [moduleName, tag, '子集'], index),
      () => question(`集合 $A=\\{1,2,3,4\\}$，$B=\\{3,4,5\\}$，则 $A-B=$（ ）`, '$\\{1,2\\}$', ['$\\{3,4\\}$', '$\\{5\\}$', '$\\{1,2,3,4,5\\}$'], `【知识点】差集\n【分析】$A-B$ 表示属于 A 但不属于 B 的元素。\n【详解】A 中去掉 3、4，剩下 $\\{1,2\\}$。`, [moduleName, tag, '差集'], index),
      () => question(`若集合 $A$ 有 3 个元素，集合 $B$ 有 4 个元素，且 $A\\cap B$ 有 1 个元素，则 $A\\cup B$ 有（ ）个元素`, '$6$', ['$7$', '$8$', '$1$'], `【知识点】容斥原理\n【分析】$|A\\cup B|=|A|+|B|-|A\\cap B|$。\n【详解】$3+4-1=6$。`, [moduleName, tag, '容斥原理'], index)
    ];
    return variants[index % variants.length]();
  }

  if (topicSlug === 'math-probability') {
    const red = (n % 5) + 1;
    const total = red + 5 + n;
    const nums = [n, n + 2, n + 4];
    const avg = n + 2;
    const variants = [
      () => question(`袋中有 ${total} 个球，其中 ${red} 个红球，随机取 1 个为红球的概率是（ ）`, `$\\frac{${red}}{${total}}$`, [`$\\frac{${total - red}}{${total}}$`, `$\\frac{1}{${total}}$`, `$\\frac{${red}}{${total + red}}$`], `【知识点】古典概型\n【分析】概率等于有利结果数除以总结果数。\n【详解】红球概率为 $\\frac{${red}}{${total}}$。`, [moduleName, tag, '古典概型'], index),
      () => question(`抛一枚均匀硬币 2 次，至少出现 1 次正面的概率是（ ）`, '$\\frac34$', ['$\\frac12$', '$\\frac14$', '$1$'], `【知识点】对立事件\n【分析】至少一次正面的对立事件是两次都是反面。\n【详解】概率为 $1-\\frac14=\\frac34$。`, [moduleName, tag, '对立事件'], index),
      () => question(`数据 ${nums.join('，')} 的平均数是（ ）`, `$${avg}$`, [`$${avg + 1}$`, `$${avg - 1}$`, `$${avg * 3}$`], `【知识点】平均数\n【分析】平均数为总和除以个数。\n【详解】$\\frac{${nums.reduce((a, b) => a + b, 0)}}{3}=${avg}$。`, [moduleName, tag, '平均数'], index),
      () => question(`数据 $1,2,2,4,6$ 的中位数是（ ）`, '$2$', ['$1$', '$3$', '$4$'], `【知识点】中位数\n【分析】数据从小到大排列后，中间位置的数为中位数。\n【详解】第 3 个数是 2。`, [moduleName, tag, '中位数'], index),
      () => question(`从 5 名同学中选 2 名参加比赛，共有（ ）种选法`, '$10$', ['$20$', '$5$', '$7$'], `【知识点】组合\n【分析】只选人不排序，用组合数。\n【详解】$C_5^2=\\frac{5\\times4}{2}=10$。`, [moduleName, tag, '组合'], index),
      () => question(`从 4 个不同元素中取 2 个排成一列，共有（ ）种排列`, '$12$', ['$6$', '$8$', '$16$'], `【知识点】排列\n【分析】取出后需要排序，用排列数。\n【详解】$A_4^2=4\\times3=12$。`, [moduleName, tag, '排列'], index),
      () => question(`数据 $2,4,4,6$ 的方差是（ ）`, '$2$', ['$1$', '$4$', '$8$'], `【知识点】方差\n【分析】先求平均数，再求平方差的平均。\n【详解】平均数为 4，方差为 $\\frac{(2-4)^2+0^2+0^2+(6-4)^2}{4}=2$。`, [moduleName, tag, '方差'], index)
    ];
    return variants[index % variants.length]();
  }

  return null;
}

function buildExpandedChemistryQuestion(moduleName, topicTitle, topicSlug, index) {
  const n = index + 1;
  const tag = topicTitle;
  const pick = (variants) => {
    const builder = variants[index % variants.length];
    const item = builder(n);
    return {
      ...item,
      prompt: `【${topicTitle}】${item.prompt}`
    };
  };

  const basicConcepts = new Set([
    'chemistry-amount-calculation',
    'chemistry-classification-state',
    'chemistry-atomic-structure',
    'chemistry-chemical-bonding',
    'chemistry-notation-equation'
  ]);
  const reactionPrinciples = new Set([
    'chemistry-redox',
    'chemistry-ion',
    'chemistry-equilibrium'
  ]);
  const solutionChemistry = new Set([
    'chemistry-electrolyte-solution',
    'chemistry-concentration-ph',
    'chemistry-ideal-gas'
  ]);
  const matterApplication = new Set([
    'chemistry-inorganic-properties',
    'chemistry-organic-basic',
    'chemistry-experiment-application',
    'chemistry-industrial-process'
  ]);

  if (basicConcepts.has(topicSlug)) {
    const variants = [
      () => question(`第 ${n} 题，质量为 18 g 的水的物质的量约为（ ）`, '1 mol', ['0.5 mol', '2 mol', '18 mol'], `水的摩尔质量为 18 g/mol，$n=m/M=18/18=1$ mol。`, [moduleName, tag, '物质的量'], index),
      () => question(`第 ${n} 题，下列属于纯净物的是（ ）`, '蒸馏水', ['空气', '海水', '黄铜'], `纯净物只含一种物质，蒸馏水可看作只含 $H_2O$。空气、海水和黄铜都是混合物。`, [moduleName, tag, '物质分类'], index),
      () => question(`第 ${n} 题，决定元素种类的是原子的（ ）`, '质子数', ['中子数', '电子层数', '相对原子质量'], `元素种类由原子核内质子数决定，同种元素的质子数相同。`, [moduleName, tag, '原子结构'], index),
      () => question(`第 ${n} 题，氯化钠晶体中主要存在的化学键是（ ）`, '离子键', ['共价键', '金属键', '氢键'], `钠原子失电子、氯原子得电子形成 $Na^+$ 和 $Cl^-$，二者之间主要是离子键。`, [moduleName, tag, '化学键'], index),
      () => question(`第 ${n} 题，硫酸根离子的符号是（ ）`, '$SO_4^{2-}$', ['$SO_3^{2-}$', '$SO_4^-$', '$S^{2-}$'], `硫酸根由一个硫原子和四个氧原子组成，整体带 2 个单位负电荷。`, [moduleName, tag, '化学用语'], index),
      () => question(`第 ${n} 题，下列变化一定属于化学变化的是（ ）`, '铁生锈', ['冰融化', '酒精挥发', '食盐溶解'], `铁生锈生成了新物质氧化铁，属于化学变化；其余主要是物理变化。`, [moduleName, tag, '物质变化'], index),
      () => question(`第 ${n} 题，同一周期从左到右，主族元素原子半径通常（ ）`, '逐渐减小', ['逐渐增大', '先增大后减小', '基本不变'], `同周期核电荷数增加，电子层数基本相同，核对外层电子吸引增强，原子半径通常减小。`, [moduleName, tag, '周期律'], index),
      () => question(`第 ${n} 题，配平方程式时必须遵守的核心原则是（ ）`, '反应前后原子种类和数目守恒', ['反应前后分子数相等', '所有物质化学计量数相同', '生成物质量一定更大'], `化学方程式配平依据质量守恒，本质是反应前后各元素原子种类和数目相等。`, [moduleName, tag, '方程式配平'], index),
      () => question(`第 ${n} 题，$CO_2$ 中碳元素的化合价是（ ）`, '+4', ['+2', '-4', '0'], `氧通常为 -2 价，两个氧共 -4，分子整体为 0，所以碳为 +4 价。`, [moduleName, tag, '化合价'], index),
      () => question(`第 ${n} 题，从电离角度看，酸在水溶液中能电离出的共同阳离子是（ ）`, '$H^+$', ['$OH^-$', '$Na^+$', '$Cl^-$'], `酸在水溶液中电离出的阳离子全部是氢离子，这是酸的共同特征。`, [moduleName, tag, '酸碱基础'], index)
    ];
    return pick(variants);
  }

  if (reactionPrinciples.has(topicSlug)) {
    const variants = [
      () => question(`第 ${n} 题，氧化还原反应的本质是（ ）`, '电子转移', ['生成沉淀', '吸收热量', '溶液变色'], `氧化还原反应的本质是电子发生转移，表现为元素化合价发生变化。`, [moduleName, tag, '氧化还原'], index),
      () => question(`第 ${n} 题，某元素化合价升高，说明该元素（ ）`, '被氧化', ['被还原', '一定作氧化剂', '一定生成单质'], `化合价升高对应失电子过程，失电子被氧化。`, [moduleName, tag, '化合价变化'], index),
      () => question(`第 ${n} 题，向 $AgNO_3$ 溶液中加入 $NaCl$ 溶液，主要现象是（ ）`, '产生白色沉淀', ['产生红褐色沉淀', '放出氢气', '溶液变紫色'], `$Ag^+$ 与 $Cl^-$ 结合生成难溶的白色 $AgCl$ 沉淀。`, [moduleName, tag, '离子反应'], index),
      () => question(`第 ${n} 题，书写离子方程式时，强酸、强碱和可溶性盐通常应写成（ ）`, '离子形式', ['分子形式', '原子形式', '单质形式'], `强电解质在水溶液中完全电离，离子方程式中通常拆写为离子。`, [moduleName, tag, '离子方程式'], index),
      () => question(`第 ${n} 题，可逆反应达到化学平衡时，正、逆反应速率（ ）`, '相等且不为零', ['都等于零', '正反应速率更大', '逆反应速率更大'], `化学平衡是动态平衡，正逆反应仍在进行，但速率相等。`, [moduleName, tag, '化学平衡'], index),
      () => question(`第 ${n} 题，其他条件不变时，升高温度通常会使化学反应速率（ ）`, '增大', ['减小', '变为零', '一定不变'], `升温使活化分子比例增大，有效碰撞增多，反应速率通常增大。`, [moduleName, tag, '反应速率'], index),
      () => question(`第 ${n} 题，对于吸热可逆反应，升高温度时平衡一般向（ ）`, '吸热方向移动', ['放热方向移动', '气体体积小的方向移动', '沉淀生成方向移动'], `勒夏特列原理表明，升温后平衡会向吸收热量的方向移动。`, [moduleName, tag, '平衡移动'], index),
      () => question(`第 ${n} 题，氧化剂在反应中通常（ ）`, '得到电子', ['失去电子', '化合价升高', '一定生成气体'], `氧化剂使其他物质被氧化，自身得到电子、化合价降低。`, [moduleName, tag, '氧化剂'], index),
      () => question(`第 ${n} 题，下列通常是离子反应发生条件的是（ ）`, '生成难溶物', ['溶液颜色完全相同', '反应物都是单质', '温度保持不变'], `复分解型离子反应常因生成沉淀、气体或弱电解质而发生。`, [moduleName, tag, '离子反应条件'], index),
      () => question(`第 ${n} 题，加入催化剂后，下列说法正确的是（ ）`, '能改变反应速率但不改变平衡常数', ['一定提高平衡转化率', '只加快正反应速率', '改变反应热'], `催化剂降低正逆反应活化能，改变达到平衡的快慢，但不改变平衡常数和反应热。`, [moduleName, tag, '催化剂'], index)
    ];
    return pick(variants);
  }

  if (solutionChemistry.has(topicSlug)) {
    const variants = [
      () => question(`第 ${n} 题，物质的量浓度 $c$ 与溶质物质的量 $n$、溶液体积 $V$ 的关系是（ ）`, '$c=n/V$', ['$c=m/V$', '$c=nV$', '$c=V/n$'], `物质的量浓度定义为单位体积溶液中所含溶质的物质的量，即 $c=n/V$。`, [moduleName, tag, '物质的量浓度'], index),
      () => question(`第 ${n} 题，常温下某溶液 $pH=3$，该溶液呈（ ）`, '酸性', ['中性', '碱性', '无法判断'], `常温下 $pH<7$ 的水溶液呈酸性，$pH=3$ 酸性较强。`, [moduleName, tag, 'pH'], index),
      () => question(`第 ${n} 题，下列物质在水溶液中属于强电解质的是（ ）`, '$NaCl$', ['$CH_3COOH$', '$NH_3\\cdot H_2O$', '$C_2H_5OH$'], `$NaCl$ 是可溶性盐，在水中几乎完全电离，属于强电解质。`, [moduleName, tag, '电解质'], index),
      () => question(`第 ${n} 题，电解质溶液能导电，主要因为溶液中存在（ ）`, '自由移动的离子', ['自由移动的分子', '静止的原子核', '大量中子'], `电流在电解质溶液中由自由移动的阴、阳离子定向迁移形成。`, [moduleName, tag, '溶液导电'], index),
      () => question(`第 ${n} 题，一定量理想气体在温度不变时，压强增大，则体积（ ）`, '减小', ['增大', '不变', '先增大后减小'], `等温条件下理想气体满足 $pV=常数$，压强增大时体积减小。`, [moduleName, tag, '理想气体'], index),
      () => question(`第 ${n} 题，使用理想气体状态方程 $pV=nRT$ 时，温度应使用（ ）`, '开尔文温度', ['摄氏温度', '华氏温度', '任意温标'], `理想气体状态方程中的 $T$ 是热力学温度，单位为 K。`, [moduleName, tag, '状态方程'], index),
      () => question(`第 ${n} 题，将一定量溶液加水稀释后，保持不变的是溶质的（ ）`, '物质的量', ['物质的量浓度', '溶液体积', 'pH 一定'], `稀释只是加入溶剂，若无反应或损失，溶质物质的量不变，浓度变小。`, [moduleName, tag, '稀释'], index),
      () => question(`第 ${n} 题，弱电解质在水溶液中的电离特点是（ ）`, '部分电离', ['完全电离', '完全不电离', '只生成电子'], `弱电解质在水中只有一部分分子电离，存在电离平衡。`, [moduleName, tag, '弱电解质'], index),
      () => question(`第 ${n} 题，0.1 mol/L 的盐酸中，忽略水的电离，$H^+$ 浓度约为（ ）`, '0.1 mol/L', ['0.01 mol/L', '1 mol/L', '10 mol/L'], `盐酸是强酸，近似完全电离，$c(H^+)\\approx c(HCl)=0.1$ mol/L。`, [moduleName, tag, '强酸电离'], index),
      () => question(`第 ${n} 题，定容容器中一定量理想气体温度升高时，压强通常（ ）`, '增大', ['减小', '为零', '不变'], `由 $pV=nRT$ 可知，$n$ 和 $V$ 不变时，$p$ 与 $T$ 成正比。`, [moduleName, tag, '气体压强'], index)
    ];
    return pick(variants);
  }

  if (matterApplication.has(topicSlug)) {
    const variants = [
      () => question(`第 ${n} 题，碳酸盐与足量稀盐酸反应通常会产生（ ）`, '$CO_2$', ['$H_2$', '$O_2$', '$NH_3$'], `碳酸根与酸反应生成碳酸，碳酸分解放出二氧化碳。`, [moduleName, tag, '无机性质'], index),
      () => question(`第 ${n} 题，烃类化合物一定含有的元素是（ ）`, '碳和氢', ['碳和氧', '氢和氯', '氧和氮'], `烃是只由碳、氢两种元素组成的有机化合物。`, [moduleName, tag, '有机基础'], index),
      () => question(`第 ${n} 题，醇类常见的官能团是（ ）`, '羟基 $-OH$', ['羧基 $-COOH$', '醛基 $-CHO$', '硝基 $-NO_2$'], `醇的特征官能团是羟基 $-OH$，连接在饱和碳原子上。`, [moduleName, tag, '官能团'], index),
      () => question(`第 ${n} 题，实验室闻未知气体气味时，正确操作是（ ）`, '用手轻轻扇闻', ['直接凑近瓶口闻', '深吸一口气', '堵住通风口闻'], `闻气体气味应采用扇闻法，避免直接吸入过量或有毒气体。`, [moduleName, tag, '实验安全'], index),
      () => question(`第 ${n} 题，分离不溶性固体和液体的常用方法是（ ）`, '过滤', ['蒸发结晶', '萃取', '蒸馏'], `过滤利用滤纸或滤膜截留不溶性固体，使液体通过。`, [moduleName, tag, '物质分离'], index),
      () => question(`第 ${n} 题，乙烯能使溴水褪色，主要发生的是（ ）`, '加成反应', ['取代反应', '中和反应', '沉淀反应'], `乙烯含碳碳双键，能与溴发生加成反应，使溴水褪色。`, [moduleName, tag, '烯烃性质'], index),
      () => question(`第 ${n} 题，工业流程中循环利用未反应物，主要目的是（ ）`, '提高原料利用率', ['降低反应速率', '减少目标产物', '使反应停止'], `循环利用可减少原料浪费，提高转化利用效率并降低排放。`, [moduleName, tag, '工业流程'], index),
      () => question(`第 ${n} 题，检验溶液中 $Cl^-$ 时，常加入硝酸酸化的（ ）`, '$AgNO_3$ 溶液', ['$BaCl_2$ 溶液', '$NaOH$ 溶液', '酚酞溶液'], `$Ag^+$ 与 $Cl^-$ 生成白色 $AgCl$ 沉淀，稀硝酸酸化可排除部分干扰。`, [moduleName, tag, '离子检验'], index),
      () => question(`第 ${n} 题，互为同分异构体的有机物一定具有相同的（ ）`, '分子式', ['结构式', '沸点', '官能团位置'], `同分异构体分子式相同，但结构不同，性质可能不同。`, [moduleName, tag, '同分异构'], index),
      () => question(`第 ${n} 题，活泼金属与稀盐酸反应通常生成盐和（ ）`, '$H_2$', ['$O_2$', '$CO_2$', '$N_2$'], `活泼金属置换酸中的氢，生成相应盐和氢气。`, [moduleName, tag, '金属性质'], index)
    ];
    return pick(variants);
  }

  return null;
}

function buildExpandedPhysicsQuestion(moduleName, topicTitle, topicSlug, index) {
  const n = index + 1;
  const tag = topicTitle;
  const pick = (variants) => {
    const item = variants[index % variants.length]();
    return { ...item, prompt: `【${topicTitle}】${item.prompt}` };
  };

  if (['physics-force', 'physics-motion', 'physics-work-energy', 'physics-circular-gravity', 'physics-momentum'].includes(topicSlug)) {
    const m = (n % 5) + 2;
    const a = (n % 4) + 1;
    const v = n + 3;
    const t = (n % 6) + 2;
    const r = (n % 5) + 2;
    const variants = [
      () => question(`第 ${n} 题，质量为 $${m}\\,kg$ 的物体受到合力 $${m * a}\\,N$，加速度为（ ）`, `$${a}\\,m/s^2$`, [`$${m * a}\\,m/s^2$`, `$${m + a}\\,m/s^2$`, `$\\frac{${m}}{${a}}\\,m/s^2$`], '【知识点】牛顿第二定律\n【分析】由 $F=ma$ 反求加速度。\n【详解】$a=F/m$。', [moduleName, tag, '牛顿第二定律'], index),
      () => question(`第 ${n} 题，物体由静止做匀加速直线运动，加速度 $${a}\\,m/s^2$，$${t}\\,s$ 后速度为（ ）`, `$${a * t}\\,m/s$`, [`$${a + t}\\,m/s$`, `$${t}\\,m/s$`, `$${a * t * t}\\,m/s$`], '【知识点】匀变速运动\n【分析】初速度为 0 时 $v=at$。\n【详解】代入即可。', [moduleName, tag, '速度公式'], index),
      () => question(`第 ${n} 题，线速度 $${v}\\,m/s$、半径 $${r}\\,m$ 的匀速圆周运动，向心加速度为（ ）`, `$\\frac{${v * v}}{${r}}\\,m/s^2$`, [`$\\frac{${v}}{${r}}\\,m/s^2$`, `$${v * r}\\,m/s^2$`, `$\\frac{${r}}{${v}}\\,m/s^2$`], '【知识点】向心加速度\n【分析】$a_c=\\frac{v^2}{r}$。\n【详解】代入速度和半径。', [moduleName, tag, '圆周运动'], index),
      () => question(`第 ${n} 题，质量 $${m}\\,kg$、速度 $${v}\\,m/s$ 的物体动量大小为（ ）`, `$${m * v}\\,kg\\cdot m/s$`, [`$${m + v}\\,kg\\cdot m/s$`, `$${m * v * v}\\,kg\\cdot m/s$`, `$\\frac{${v}}{${m}}\\,kg\\cdot m/s$`], '【知识点】动量\n【分析】动量 $p=mv$。\n【详解】质量乘速度。', [moduleName, tag, '动量'], index),
      () => question(`第 ${n} 题，恒力 $${m * a}\\,N$ 沿位移方向作用 $${t}\\,m$，做功为（ ）`, `$${m * a * t}\\,J$`, [`$${m * a + t}\\,J$`, `$${m * a / t}\\,J$`, `$${2 * m * a * t}\\,J$`], '【知识点】功\n【分析】力与位移同向时 $W=Fs$。\n【详解】相乘即可。', [moduleName, tag, '功'], index),
      () => question(`第 ${n} 题，物体所受合力为零时，下列说法正确的是（ ）`, '速度可能不为零', ['一定静止', '加速度一定不为零', '速度一定增大'], '【知识点】牛顿第一定律\n【分析】合力为零只说明加速度为零。\n【详解】物体可静止，也可匀速直线运动。', [moduleName, tag, '惯性定律'], index)
    ];
    return pick(variants);
  }

  if (['physics-electrostatic-field', 'physics-magnetic', 'physics-circuit', 'physics-electromagnetic-induction'].includes(topicSlug)) {
    const r = (n % 6) + 2;
    const i = (n % 4) + 1;
    const q = (n % 5) + 1;
    const e = (n % 4) + 3;
    const variants = [
      () => question(`第 ${n} 题，电阻 $${r}\\,\\Omega$ 中电流为 $${i}\\,A$，两端电压为（ ）`, `$${r * i}\\,V$`, [`$${r + i}\\,V$`, `$\\frac{${r}}{${i}}\\,V$`, `$${r * i * i}\\,V$`], '【知识点】欧姆定律\n【分析】$U=IR$。\n【详解】电流与电阻相乘。', [moduleName, tag, '欧姆定律'], index),
      () => question(`第 ${n} 题，电荷量 $${q}\\,C$ 的正电荷在 $${e}\\,N/C$ 的电场中受力大小为（ ）`, `$${q * e}\\,N$`, [`$${q + e}\\,N$`, `$\\frac{${e}}{${q}}\\,N$`, `$${q * e * e}\\,N$`], '【知识点】电场力\n【分析】$F=qE$。\n【详解】代入电荷量和电场强度。', [moduleName, tag, '电场力'], index),
      () => question(`第 ${n} 题，闭合线圈中磁通量增大时，感应电流磁场的趋势是（ ）`, '阻碍磁通量增大', ['促进磁通量增大', '使电阻为零', '与磁通量无关'], '【知识点】楞次定律\n【分析】感应电流总阻碍引起它的磁通量变化。\n【详解】磁通量增大时就阻碍增大。', [moduleName, tag, '楞次定律'], index),
      () => question(`第 ${n} 题，通电导线在磁场中受力方向通常可用（ ）判断`, '左手定则', ['右手螺旋定则', '折射定律', '分子动理论'], '【知识点】安培力方向\n【分析】安培力方向常用左手定则判断。\n【详解】左手定则联系电流、磁场和受力方向。', [moduleName, tag, '安培力'], index),
      () => question(`第 ${n} 题，两个相同电阻并联后，总电阻与单个电阻相比（ ）`, '变小', ['变大', '不变', '变为无穷大'], '【知识点】并联电路\n【分析】并联等效电阻小于任一支路电阻。\n【详解】两个相同电阻并联等效为一半。', [moduleName, tag, '并联电路'], index),
      () => question(`第 ${n} 题，带正电粒子垂直进入匀强磁场做圆周运动时，洛伦兹力（ ）`, '只改变速度方向', ['只改变速度大小', '对粒子做正功', '使动能不断增大'], '【知识点】洛伦兹力\n【分析】洛伦兹力始终垂直速度，不做功。\n【详解】它改变方向，不改变速率。', [moduleName, tag, '洛伦兹力'], index)
    ];
    return pick(variants);
  }

  if (['physics-harmonic-wave', 'physics-geometric-optics', 'physics-physical-optics', 'physics-optics'].includes(topicSlug)) {
    const f = (n % 5) + 2;
    const lambda = (n % 4) + 1;
    const variants = [
      () => question(`第 ${n} 题，机械波频率 $${f}\\,Hz$、波长 $${lambda}\\,m$，波速为（ ）`, `$${f * lambda}\\,m/s$`, [`$${f + lambda}\\,m/s$`, `$\\frac{${f}}{${lambda}}\\,m/s$`, `$\\frac{${lambda}}{${f}}\\,m/s$`], '【知识点】波速公式\n【分析】$v=f\\lambda$。\n【详解】频率乘波长。', [moduleName, tag, '波速'], index),
      () => question(`第 ${n} 题，波速不变时，频率增大，波长将（ ）`, '减小', ['增大', '不变', '变为零'], '【知识点】波速关系\n【分析】$v=f\\lambda$，波速不变时频率与波长成反比。\n【详解】频率越大，波长越小。', [moduleName, tag, '波长'], index),
      () => question(`第 ${n} 题，平面镜成像的性质是（ ）`, '正立、等大、虚像', ['倒立、放大、实像', '正立、缩小、实像', '倒立、等大、虚像'], '【知识点】平面镜成像\n【分析】平面镜成虚像，且像物等大。\n【详解】像与物关于镜面对称。', [moduleName, tag, '平面镜'], index),
      () => question(`第 ${n} 题，光从空气斜射入水中，折射角通常（ ）入射角`, '小于', ['大于', '等于', '无法比较'], '【知识点】折射\n【分析】从光疏介质进入光密介质，光线向法线偏折。\n【详解】折射角小于入射角。', [moduleName, tag, '折射'], index),
      () => question(`第 ${n} 题，双缝干涉主要说明光具有（ ）`, '波动性', ['粒子性唯一', '机械性', '热传导性'], '【知识点】干涉\n【分析】干涉是波的重要特征。\n【详解】双缝干涉体现波动性。', [moduleName, tag, '干涉'], index),
      () => question(`第 ${n} 题，只有横波才有的典型现象是（ ）`, '偏振', ['反射', '折射', '衍射'], '【知识点】偏振\n【分析】偏振是横波特有的现象。\n【详解】光的偏振说明光是横波。', [moduleName, tag, '偏振'], index)
    ];
    return pick(variants);
  }

  if (['physics-ideal-gas', 'physics-molecular-kinetic', 'physics-thermodynamics-first-law', 'physics-thermal'].includes(topicSlug)) {
    const c = (n % 4) + 2;
    const m = (n % 5) + 1;
    const dt = (n % 6) + 3;
    const variants = [
      () => question(`第 ${n} 题，$c=${c}$，$m=${m}$，$\\Delta t=${dt}$，则吸热量 $Q=$（ ）`, `$${c * m * dt}$`, [`$${c + m + dt}$`, `$${c * m}$`, `$${m * dt}$`], '【知识点】热量计算\n【分析】$Q=cm\\Delta t$。\n【详解】三个量相乘。', [moduleName, tag, '热量'], index),
      () => question(`第 ${n} 题，一定质量理想气体等温膨胀时，压强通常（ ）`, '减小', ['增大', '不变', '变为零'], '【知识点】玻意耳定律\n【分析】等温时 $pV$ 为常量。\n【详解】体积增大，压强减小。', [moduleName, tag, '理想气体'], index),
      () => question(`第 ${n} 题，温度升高从微观上表示分子平均动能（ ）`, '增大', ['减小', '不变', '消失'], '【知识点】温度微观意义\n【分析】温度是分子平均动能的标志。\n【详解】温度越高，平均动能越大。', [moduleName, tag, '分子动理论'], index),
      () => question(`第 ${n} 题，气体吸热 $50\\,J$，同时对外做功 $20\\,J$，内能变化为（ ）`, '增加 $30\\,J$', ['减少 $30\\,J$', '增加 $70\\,J$', '不变'], '【知识点】热力学第一定律\n【分析】$\\Delta U=Q-W$。\n【详解】$50-20=30\\,J$。', [moduleName, tag, '热力学第一定律'], index),
      () => question(`第 ${n} 题，扩散现象说明分子（ ）`, '不停地无规则运动', ['静止不动', '只沿直线运动', '没有间隙'], '【知识点】分子热运动\n【分析】扩散是分子无规则热运动的表现。\n【详解】分子在不停运动。', [moduleName, tag, '扩散'], index),
      () => question(`第 ${n} 题，理想气体状态方程中的温度应使用（ ）`, '热力学温度', ['摄氏温度直接代入', '华氏温度', '任意单位'], '【知识点】温度单位\n【分析】$pV=nRT$ 中 $T$ 用开尔文温度。\n【详解】不能直接代入摄氏温度。', [moduleName, tag, '温度单位'], index)
    ];
    return pick(variants);
  }

  if (['physics-photoelectric-effect', 'physics-atomic', 'physics-nuclear', 'physics-modern'].includes(topicSlug)) {
    const half = (index % 4) + 1;
    const variants = [
      () => question(`第 ${n} 题，光电效应说明光具有（ ）`, '粒子性', ['只具有机械性', '只具有热效应', '没有能量'], '【知识点】光电效应\n【分析】光电效应体现光子的能量一份一份传递。\n【详解】说明光具有粒子性。', [moduleName, tag, '光电效应'], index),
      () => question(`第 ${n} 题，发生光电效应时，入射光频率必须（ ）极限频率`, '不小于', ['小于', '等于 0', '无关'], '【知识点】极限频率\n【分析】单个光子能量要足够大。\n【详解】频率应大于或等于极限频率。', [moduleName, tag, '极限频率'], index),
      () => question(`第 ${n} 题，原子从高能级跃迁到低能级时会（ ）`, '放出光子', ['吸收光子', '质量变为零', '电荷消失'], '【知识点】能级跃迁\n【分析】能量降低，能量差以光子形式释放。\n【详解】因此放出光子。', [moduleName, tag, '能级跃迁'], index),
      () => question(`第 ${n} 题，放射性元素经过 ${half} 个半衰期后，剩余量为原来的（ ）`, `$\\frac{1}{${2 ** half}}$`, [`$\\frac{${half}}{2}$`, `$\\frac{1}{${half}}$`, '$0$'], '【知识点】半衰期\n【分析】每经过一个半衰期，剩余量减半。\n【详解】经过 $k$ 个半衰期后剩 $1/2^k$。', [moduleName, tag, '半衰期'], index),
      () => question(`第 ${n} 题，核反应释放能量常与（ ）有关`, '质量亏损', ['欧姆定律', '折射角', '热容'], '【知识点】质能方程\n【分析】质量亏损可由 $E=mc^2$ 对应能量释放。\n【详解】核能来自质量与能量转换。', [moduleName, tag, '质量亏损'], index),
      () => question(`第 ${n} 题，若入射光频率低于极限频率，即使增大光强也（ ）`, '不能发生光电效应', ['一定发生光电效应', '逸出功变小', '电子最大初动能变大'], '【知识点】光电效应易错点\n【分析】能否逸出取决于单个光子的频率是否足够。\n【详解】光强不能弥补频率不足。', [moduleName, tag, '光电效应'], index)
    ];
    return pick(variants);
  }

  return null;
}

function aText(value) {
  return String(value);
}

function buildTopicQuestions(subjectId, moduleName, topicTitle, topicSlug) {
  return Array.from({ length: questionCountForTopic(topicSlug) }, (_, index) => {
    const n = index + 1;
    const tag = topicTitle;
    if (subjectId === 'math') {
      const expandedQuestion = buildExpandedMathQuestion(moduleName, topicTitle, topicSlug, index);
      if (expandedQuestion) return expandedQuestion;
      if (topicSlug.includes('set')) {
        const variants = [
          () => question(`设 A={1,2,${n + 2}}，B={2,${n + 2},${n + 3}}，则 A∩B=（ ）`, `{2, ${n + 2}}`, [`{1, ${n + 3}}`, `{1,2,${n + 2},${n + 3}}`, `{${n + 3}}`], `交集只保留两个集合同时含有的元素，A 与 B 共有 2 和 ${n + 2}。`, [moduleName, tag, '交集'], index),
          () => {
            const universe = Array.from({ length: 6 }, (_, itemIndex) => itemIndex + 1);
            const middle = (n % 4) + 2;
            const setA = [1, middle, 6];
            const complement = universe.filter((value) => !setA.includes(value));
            return question(`设全集 U={${universe.join(',')}}，A={${setA.join(',')}}，则 A 在 U 中的补集是（ ）`, `{${complement.join(',')}}`, [`{1,6}`, `{${middle},6}`, `{${universe.join(',')}}`], `补集是在全集 U 中但不属于 A 的元素，先列出全集再划去 A 的元素。`, [moduleName, tag, '补集'], index);
          },
          () => question(`若 A⊆B，A={${n},${n + 1}}，B={${n},${n + 1},${n + 2}}，下列判断正确的是（ ）`, `A 的每个元素都在 B 中`, ['B 的每个元素都在 A 中', 'A 与 B 没有公共元素', 'A∪B=A'], `子集关系要求 A 中所有元素都能在 B 中找到，因此 A⊆B 成立。`, [moduleName, tag, '子集'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('inequality')) {
        const a = n + 2;
        const b = n * 2 + 9;
        const answer = b - a;
        const variants = [
          () => question(`不等式 x + ${a} > ${b} 的解集为（ ）`, `x > ${answer}`, [`x < ${answer}`, `x ≥ ${answer}`, `x ≤ ${answer}`], `移项时两边同时减去 ${a}，不等号方向不变，得到 x > ${answer}。`, [moduleName, tag, '一元一次不等式'], index),
          () => question(`不等式 2x ≥ ${2 * answer} 的解集为（ ）`, `x ≥ ${answer}`, [`x > ${answer}`, `x ≤ ${answer}`, `x < ${answer}`], `两边同时除以正数 2，不等号方向不变，得到 x ≥ ${answer}。`, [moduleName, tag, '不等式性质'], index),
          () => question(`若 x - ${a} < ${answer}，则 x 的取值范围是（ ）`, `x < ${answer + a}`, [`x > ${answer + a}`, `x ≤ ${answer}`, `x < ${answer}`], `两边同时加 ${a}，得到 x < ${answer + a}，注意这里没有改变不等号方向。`, [moduleName, tag, '移项'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'math-function') {
        const functionQuestions = [
          {
            prompt: '已知函数 $f(x)=2x-3$，则 $f(4)=$（ ）',
            options: [
              { id: 'A', text: '$5$' },
              { id: 'B', text: '$6$' },
              { id: 'C', text: '$7$' },
              { id: 'D', text: '$8$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】求函数值\n【分析】将自变量 $x=4$ 代入函数解析式即可。\n【详解】$f(4)=2\\times4-3=8-3=5$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '函数值', '代入求值']
          },
          {
            prompt: '函数 $f(x)=\\frac{1}{x-2}$ 的定义域是（ ）',
            options: [
              { id: 'A', text: '$x\\ne2$' },
              { id: 'B', text: '$x>2$' },
              { id: 'C', text: '$x<2$' },
              { id: 'D', text: '$x\\ne0$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】求函数定义域\n【分析】分式函数要求分母不为 0。\n【详解】函数 $f(x)=\\frac{1}{x-2}$ 中，分母 $x-2\\ne0$，所以 $x\\ne2$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '定义域', '分式函数']
          },
          {
            prompt: '函数 $f(x)=3x+6$ 的零点是（ ）',
            options: [
              { id: 'A', text: '$x=-3$' },
              { id: 'B', text: '$x=-2$' },
              { id: 'C', text: '$x=2$' },
              { id: 'D', text: '$x=3$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】函数零点\n【分析】令 $f(x)=0$，解对应方程即可。\n【详解】由 $3x+6=0$，得 $3x=-6$，所以 $x=-2$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '函数零点', '一次函数']
          },
          {
            prompt: '函数 $y=f(x-3)$ 的图像可由 $y=f(x)$ 的图像（ ）得到',
            options: [
              { id: 'A', text: '向左平移 3 个单位' },
              { id: 'B', text: '向右平移 3 个单位' },
              { id: 'C', text: '向上平移 3 个单位' },
              { id: 'D', text: '向下平移 3 个单位' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】函数图像平移\n【分析】函数 $y=f(x-a)$ 的图像由 $y=f(x)$ 向右平移 $a$ 个单位得到。\n【详解】$y=f(x-3)$ 中自变量由 $x$ 变为 $x-3$，图像向右平移 3 个单位。\n故选 B。',
            knowledgeTags: [moduleName, tag, '图像变换', '平移']
          },
          {
            prompt: '函数 $f(x)=x^2$ 在区间 $[-2,3]$ 上的值域是（ ）',
            options: [
              { id: 'A', text: '$[0,9]$' },
              { id: 'B', text: '$[4,9]$' },
              { id: 'C', text: '$[-2,3]$' },
              { id: 'D', text: '$[-4,9]$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】求函数值域\n【分析】二次函数 $x^2$ 在包含 0 的区间上最小值为 0，再比较端点平方求最大值。\n【详解】区间 $[-2,3]$ 含有 $0$，所以最小值为 $0$；端点处 $f(-2)=4$，$f(3)=9$，最大值为 $9$。\n因此值域为 $[0,9]$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '值域', '二次函数']
          },
          {
            prompt: '下列函数在 $\\mathbb{R}$ 上单调递增的是（ ）',
            options: [
              { id: 'A', text: '$y=-2x+1$' },
              { id: 'B', text: '$y=3x-5$' },
              { id: 'C', text: '$y=x^2$' },
              { id: 'D', text: '$y=-x^2$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】函数单调性\n【分析】一次函数 $y=kx+b$ 中，$k>0$ 时在 $\\mathbb{R}$ 上单调递增；二次函数通常不能在整个 $\\mathbb{R}$ 上单调。\n【详解】$y=3x-5$ 的斜率 $3>0$，所以在 $\\mathbb{R}$ 上单调递增。\n故选 B。',
            knowledgeTags: [moduleName, tag, '单调性', '一次函数']
          },
          {
            prompt: '下列函数为偶函数的是（ ）',
            options: [
              { id: 'A', text: '$f(x)=x^3$' },
              { id: 'B', text: '$f(x)=x^2+1$' },
              { id: 'C', text: '$f(x)=2x-1$' },
              { id: 'D', text: '$f(x)=x+\\frac{1}{x}$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】函数奇偶性\n【分析】偶函数满足 $f(-x)=f(x)$。\n【详解】对于 $f(x)=x^2+1$，有 $f(-x)=(-x)^2+1=x^2+1=f(x)$，所以它是偶函数。\n故选 B。',
            knowledgeTags: [moduleName, tag, '偶函数', '奇偶性']
          },
          {
            prompt: '若 $f(x)=x^2-4x+1$，则函数图像的对称轴为（ ）',
            options: [
              { id: 'A', text: '$x=-2$' },
              { id: 'B', text: '$x=1$' },
              { id: 'C', text: '$x=2$' },
              { id: 'D', text: '$x=4$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】二次函数图像性质\n【分析】二次函数 $ax^2+bx+c$ 的对称轴为 $x=-\\frac{b}{2a}$。\n【详解】这里 $a=1$，$b=-4$，所以对称轴 $x=-\\frac{-4}{2\\times1}=2$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '二次函数', '对称轴']
          },
          {
            prompt: '函数 $f(x)=\\sqrt{x+1}$ 的定义域是（ ）',
            options: [
              { id: 'A', text: '$x\\ge-1$' },
              { id: 'B', text: '$x>-1$' },
              { id: 'C', text: '$x\\le-1$' },
              { id: 'D', text: '$x\\ne-1$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】含根式函数的定义域\n【分析】偶次根式要求被开方数大于或等于 0。\n【详解】$\\sqrt{x+1}$ 有意义需 $x+1\\ge0$，所以 $x\\ge-1$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '定义域', '根式函数']
          },
          {
            prompt: '若 $f(x)=2x+1$，$g(x)=x^2$，则 $f(g(3))=$（ ）',
            options: [
              { id: 'A', text: '$10$' },
              { id: 'B', text: '$17$' },
              { id: 'C', text: '$19$' },
              { id: 'D', text: '$37$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】复合函数求值\n【分析】先求内层函数 $g(3)$，再代入外层函数 $f(x)$。\n【详解】$g(3)=3^2=9$，所以 $f(g(3))=f(9)=2\\times9+1=19$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '复合函数', '函数值']
          },
          {
            prompt: '若函数 $f(x)=ax+2$ 且 $f(3)=11$，则 $a=$（ ）',
            options: [
              { id: 'A', text: '$2$' },
              { id: 'B', text: '$3$' },
              { id: 'C', text: '$4$' },
              { id: 'D', text: '$5$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】待定系数法求函数解析式\n【分析】把已知函数值代入解析式，解参数即可。\n【详解】由 $f(3)=11$，得 $3a+2=11$，所以 $3a=9$，$a=3$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '待定系数法', '一次函数']
          },
          {
            prompt: '已知一次函数 $f(x)=kx+b$，且 $f(0)=2$，$f(2)=8$，则 $f(3)=$（ ）',
            options: [
              { id: 'A', text: '$9$' },
              { id: 'B', text: '$10$' },
              { id: 'C', text: '$11$' },
              { id: 'D', text: '$12$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】一次函数解析式\n【分析】由两点函数值求出斜率和截距，再代入 $x=3$。\n【详解】$f(0)=2$，所以 $b=2$。\n又 $f(2)=8$，得 $2k+2=8$，所以 $k=3$。\n因此 $f(x)=3x+2$，$f(3)=3\\times3+2=11$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '一次函数', '待定系数法']
          },
          {
            prompt: '若 $f(x)=x^2-2x$，则 $f(x+1)-f(x)=$（ ）',
            options: [
              { id: 'A', text: '$2x-1$' },
              { id: 'B', text: '$2x$' },
              { id: 'C', text: '$2x+1$' },
              { id: 'D', text: '$1$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】函数解析式运算\n【分析】先计算 $f(x+1)$，再与 $f(x)$ 作差。\n【详解】$f(x+1)=(x+1)^2-2(x+1)=x^2-1$。\n所以 $f(x+1)-f(x)=(x^2-1)-(x^2-2x)=2x-1$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '函数解析式', '代数运算']
          },
          {
            prompt: '函数 $f(x)=x^2-6x+10$ 的最小值为（ ）',
            options: [
              { id: 'A', text: '$1$' },
              { id: 'B', text: '$2$' },
              { id: 'C', text: '$9$' },
              { id: 'D', text: '$10$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】二次函数最值\n【分析】配方或利用顶点公式求最小值。\n【详解】$f(x)=x^2-6x+10=(x-3)^2+1$。\n因为 $(x-3)^2\\ge0$，所以函数最小值为 $1$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '二次函数', '最值', '配方法']
          },
          {
            prompt: '若函数 $f(x)=\\frac{x-1}{x+2}$，则 $f(x)=0$ 的解为（ ）',
            options: [
              { id: 'A', text: '$x=-2$' },
              { id: 'B', text: '$x=-1$' },
              { id: 'C', text: '$x=0$' },
              { id: 'D', text: '$x=1$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】分式函数零点\n【分析】分式值为 0 时，分子为 0 且分母不为 0。\n【详解】令 $x-1=0$，得 $x=1$；此时分母 $x+2=3\\ne0$，符合要求。\n故选 D。',
            knowledgeTags: [moduleName, tag, '函数零点', '分式函数']
          },
          {
            prompt: '已知 $f(x)=x+\\frac{1}{x}$，则下列判断正确的是（ ）',
            options: [
              { id: 'A', text: '$f(x)$ 是奇函数' },
              { id: 'B', text: '$f(x)$ 是偶函数' },
              { id: 'C', text: '$f(x)$ 的定义域为 $\\mathbb{R}$' },
              { id: 'D', text: '$f(0)=0$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】函数奇偶性与定义域\n【分析】先确认定义域，再用 $f(-x)$ 判断奇偶性。\n【详解】该函数定义域为 $x\\ne0$，关于原点对称。\n$f(-x)=-x+\\frac{1}{-x}=-(x+\\frac{1}{x})=-f(x)$，所以 $f(x)$ 是奇函数。\n故选 A。',
            knowledgeTags: [moduleName, tag, '奇函数', '定义域']
          },
          {
            prompt: '若 $f(x)=2x-1$，则反函数 $f^{-1}(x)$ 为（ ）',
            options: [
              { id: 'A', text: '$\\frac{x+1}{2}$' },
              { id: 'B', text: '$\\frac{x-1}{2}$' },
              { id: 'C', text: '$2x+1$' },
              { id: 'D', text: '$1-2x$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】求反函数\n【分析】设 $y=2x-1$，解出 $x$ 关于 $y$ 的表达式，再交换变量。\n【详解】由 $y=2x-1$，得 $2x=y+1$，所以 $x=\\frac{y+1}{2}$。\n因此 $f^{-1}(x)=\\frac{x+1}{2}$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '反函数', '一次函数']
          },
          {
            prompt: '函数 $f(x)=|x-2|$ 在区间 $[0,5]$ 上的最大值为（ ）',
            options: [
              { id: 'A', text: '$2$' },
              { id: 'B', text: '$3$' },
              { id: 'C', text: '$5$' },
              { id: 'D', text: '$7$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】含绝对值函数的最值\n【分析】绝对值函数 $|x-2|$ 表示 $x$ 到 2 的距离，在闭区间上最大值出现在端点。\n【详解】$f(0)=|0-2|=2$，$f(5)=|5-2|=3$，所以最大值为 $3$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '绝对值函数', '最值']
          },
          {
            prompt: '若二次函数 $f(x)=x^2+bx+4$ 的图像经过点 $(1,1)$，则 $b=$（ ）',
            options: [
              { id: 'A', text: '$-4$' },
              { id: 'B', text: '$-3$' },
              { id: 'C', text: '$3$' },
              { id: 'D', text: '$4$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】二次函数参数计算\n【分析】函数图像经过点 $(1,1)$，说明 $f(1)=1$。\n【详解】由 $f(1)=1$，得 $1+b+4=1$，所以 $b=-4$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '二次函数', '待定系数法']
          },
          {
            prompt: '若函数 $f(x)=x^2-4x+3$，则 $f(x)<0$ 的解集为（ ）',
            options: [
              { id: 'A', text: '$(1,3)$' },
              { id: 'B', text: '$(-\\infty,1)\\cup(3,+\\infty)$' },
              { id: 'C', text: '$[1,3]$' },
              { id: 'D', text: '$(-3,-1)$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】二次函数与不等式\n【分析】先因式分解，找到抛物线与 $x$ 轴交点，再判断开口方向。\n【详解】$x^2-4x+3=(x-1)(x-3)$，零点为 $1$ 和 $3$。\n抛物线开口向上，所以函数值小于 0 的区间在两个零点之间，即 $(1,3)$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '二次函数', '不等式', '零点']
          }
        ];
        return functionQuestions[index];
      }
      if (topicSlug.includes('function-basic')) {
        if (index === 0) {
          return {
            prompt: '已知幂函数 $f(x)=\\frac{1}{\\sqrt{x}}$，则下列结论正确的是（ ）',
            options: [
              { id: 'A', text: '$f(x)$ 在 $\\mathbb{R}$ 上单调递减' },
              { id: 'B', text: '$f(x)$ 的图象关于 $y$ 轴对称' },
              { id: 'C', text: '$f(x)$ 的图象过点 $(0,0)$' },
              { id: 'D', text: '$f(\\pi)<f(3)$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】求幂函数的定义域，判断一般幂函数的单调性，判断五种常见幂函数的奇偶性\n【分析】根据幂函数的性质即可结合选项逐一求解。\n【详解】由于 $f(x)=\\frac{1}{\\sqrt{x}}$ 的定义域为 $(0,+\\infty)$，故 A、B、C 错误；$f(x)=\\frac{1}{\\sqrt{x}}=x^{-\\frac12}$ 在 $(0,+\\infty)$ 上单调递减，又 $\\pi>3$，所以 $f(\\pi)<f(3)$，D 正确。',
            knowledgeTags: [moduleName, tag, '幂函数', '定义域', '单调性', '奇偶性']
          };
        }
        if (index === 1) {
          return {
            prompt: '下列函数中，既是奇函数又在 $(0,+\\infty)$ 单调递增的是（ ）',
            options: [
              { id: 'A', text: '$y=x^3$' },
              { id: 'B', text: '$y=|x|+1$' },
              { id: 'C', text: '$y=-x^2+1$' },
              { id: 'D', text: '$y=2^{-|x|}$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】函数奇偶性的定义与判断，判断一般幂函数的单调性，根据解析式直接判断函数的单调性。\n【分析】利用奇偶性及单调性逐项判断即可。\n【详解】对于 A，函数 $y=x^3$ 是奇函数，在 $(0,+\\infty)$ 上单调递增，A 是；\n对于 B，函数 $y=|x|+1$ 是偶函数，不是奇函数，B 不是；\n对于 C，函数 $y=-x^2+1$ 是偶函数，不是奇函数，C 不是；\n对于 D，函数 $y=2^{-|x|}$ 是偶函数，不是奇函数，D 不是。',
            knowledgeTags: [moduleName, tag, '奇函数', '偶函数', '单调性', '幂函数']
          };
        }
        if (index === 2) {
          return {
            prompt: '已知幂函数 $f(x)$ 的图象过点 $P(2,\\sqrt{2})$，则 $f(9)=$（ ）',
            options: [
              { id: 'A', text: '3' },
              { id: 'B', text: '9' },
              { id: 'C', text: '81' },
              { id: 'D', text: '512' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】求幂函数的值\n【分析】设 $f(x)=x^a$，结合 $f(2)=\\sqrt{2}$ 可求得 $a$ 的值，可得出函数 $f(x)$ 的解析式，代值计算可得出 $f(9)$ 的值。\n【详解】设 $f(x)=x^a$，则 $f(2)=2^a=\\sqrt{2}$，所以 $a=\\frac{1}{2}$，故 $f(x)=x^{\\frac{1}{2}}=\\sqrt{x}$，因此 $f(9)=\\sqrt{9}=3$。',
            knowledgeTags: [moduleName, tag, '幂函数', '函数值', '待定系数', '代入求值']
          };
        }
        if (index === 3) {
          return {
            prompt: '设 $\\lg 2=a$，$\\lg 3=b$，则 $\\lg \\frac{9}{2}=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{2b}{a}$' },
              { id: 'B', text: '$\\frac{b}{2a}$' },
              { id: 'C', text: '$a-2b$' },
              { id: 'D', text: '$2b-a$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】对数的运算性质的应用\n【分析】运用对数的运算性质即可得解。\n【详解】$\\lg \\frac{9}{2}=\\lg 9-\\lg 2=\\lg 3^2-\\lg 2=2\\lg 3-\\lg 2=2b-a$。',
            knowledgeTags: [moduleName, tag, '对数', '对数运算', '换元表示', '基本初等函数']
          };
        }
        if (index === 4) {
          return {
            prompt: '设 $2^a=5^b=\\sqrt{10}$，则 $\\frac{1}{a}+\\frac{1}{b}$ 的值为（ ）',
            options: [
              { id: 'A', text: '$\\sqrt{2}$' },
              { id: 'B', text: '$\\frac{1}{2}$' },
              { id: 'C', text: '2' },
              { id: 'D', text: '10' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】指数式与对数式的互化，运用换底公式化简计算，对数的运算\n【分析】指数式化为对数式，然后利用对数换底公式进行计算。\n【详解】因为 $2^a=5^b=\\sqrt{10}$，所以 $a=\\log_2\\sqrt{10}$，$b=\\log_5\\sqrt{10}$，$\\frac{1}{a}+\\frac{1}{b}=\\frac{1}{\\log_2\\sqrt{10}}+\\frac{1}{\\log_5\\sqrt{10}}=\\log_{\\sqrt{10}}2+\\log_{\\sqrt{10}}5=\\log_{\\sqrt{10}}10=2$。',
            knowledgeTags: [moduleName, tag, '指数式', '对数式', '换底公式', '对数运算']
          };
        }
        if (index === 5) {
          return {
            prompt: '已知 $\\log_3 x=2$，则 $x=$（ ）',
            options: [
              { id: 'A', text: '3' },
              { id: 'B', text: '6' },
              { id: 'C', text: '9' },
              { id: 'D', text: '12' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】指数式与对数式的互化\n【分析】根据指数互化关系直接求解即可。\n【详解】由指数互化关系得 $\\log_3 x=2 \\Leftrightarrow x=3^2=9$。',
            knowledgeTags: [moduleName, tag, '对数', '指数式', '对数式', '互化']
          };
        }
        if (index === 6) {
          return {
            prompt: '$\\lg 2+\\lg 5=$（ ）',
            options: [
              { id: 'A', text: '1' },
              { id: 'B', text: '10' },
              { id: 'C', text: '$\\lg 7$' },
              { id: 'D', text: '$\\lg \\frac{2}{5}$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】对数的运算\n【分析】根据对数运算求得正确答案。\n【详解】$\\lg 2+\\lg 5=\\lg 10=1$。',
            knowledgeTags: [moduleName, tag, '对数', '常用对数', '对数运算']
          };
        }
        if (index === 7) {
          return {
            prompt: '已知角 $\\theta$ 的终边经过点 $P(-3,y)$，且 $\\tan \\theta=\\frac{4}{3}$，则 $y$ 的值是（ ）',
            options: [
              { id: 'A', text: '$-\\frac{1}{4}$' },
              { id: 'B', text: '$\\frac{1}{4}$' },
              { id: 'C', text: '-4' },
              { id: 'D', text: '4' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】由终边或终边上的点求三角函数值，由三角函数值求终边上的点或参数\n【分析】根据三角函数的定义即可求解。\n【详解】由三角函数的定义可得 $\\tan \\theta=\\frac{y}{-3}=\\frac{4}{3}$，故 $y=-4$。',
            knowledgeTags: [moduleName, tag, '三角函数', '正切', '终边', '坐标']
          };
        }
        if (index === 8) {
          return {
            prompt: '已知 $\\sin \\alpha=\\frac{5}{13}$，那么 $\\sin(\\pi-\\alpha)$ 等于（ ）',
            options: [
              { id: 'A', text: '$-\\frac{12}{13}$' },
              { id: 'B', text: '$-\\frac{5}{13}$' },
              { id: 'C', text: '$\\frac{5}{13}$' },
              { id: 'D', text: '$\\frac{12}{13}$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】诱导公式二、三、四\n【分析】根据诱导公式计算即可。\n【详解】$\\sin(\\pi-\\alpha)=\\sin \\alpha=\\frac{5}{13}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '诱导公式', '正弦']
          };
        }
        if (index === 9) {
          return {
            prompt: '已知角 $\\alpha$ 的终边经过点 $(\\frac{1}{2},-\\frac{1}{2})$，则 $\\cos \\alpha=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{1}{2}$' },
              { id: 'B', text: '$-\\frac{1}{2}$' },
              { id: 'C', text: '$\\frac{\\sqrt{2}}{2}$' },
              { id: 'D', text: '$-\\frac{\\sqrt{2}}{2}$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】由终边或终边上的点求三角函数值\n【分析】根据三角函数的定义即可求解。\n【详解】因为角 $\\alpha$ 的终边经过点 $(\\frac{1}{2},-\\frac{1}{2})$，设 $x=\\frac{1}{2}$，$y=-\\frac{1}{2}$，则 $r=\\sqrt{x^2+y^2}=\\sqrt{(\\frac{1}{2})^2+(-\\frac{1}{2})^2}=\\sqrt{\\frac{1}{2}}=\\frac{\\sqrt{2}}{2}$，所以 $\\cos \\alpha=\\frac{x}{r}=\\frac{\\frac{1}{2}}{\\frac{\\sqrt{2}}{2}}=\\frac{1}{\\sqrt{2}}=\\frac{\\sqrt{2}}{2}$，故选 C。',
            knowledgeTags: [moduleName, tag, '三角函数', '余弦', '终边', '坐标']
          };
        }
        if (index === 10) {
          return {
            prompt: '若 $\\tan \\alpha=-3$，$\\tan \\beta=5$，则 $\\tan(\\alpha-\\beta)=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{4}{7}$' },
              { id: 'B', text: '$-\\frac{4}{7}$' },
              { id: 'C', text: '$\\frac{1}{8}$' },
              { id: 'D', text: '$-\\frac{1}{8}$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】用和差角的正切公式化简、求值\n【分析】根据两角差的正切公式求得正确答案。\n【详解】$\\tan(\\alpha-\\beta)=\\frac{\\tan \\alpha-\\tan \\beta}{1+\\tan \\alpha\\tan \\beta}=\\frac{-3-5}{1+(-3)\\times 5}=\\frac{4}{7}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '正切', '两角差公式', '化简求值']
          };
        }
        if (index === 11) {
          return {
            prompt: '已知 $\\tan(\\alpha-\\frac{\\pi}{4})=\\frac{1}{3}$，则 $\\tan \\alpha=$（ ）',
            options: [
              { id: 'A', text: '2' },
              { id: 'B', text: '-2' },
              { id: 'C', text: '$\\frac{1}{2}$' },
              { id: 'D', text: '$-\\frac{1}{2}$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】用和差角的正切公式化简、求值\n【分析】由两角差的正切展开式计算可得。\n【详解】设 $\\tan \\alpha=a$，则 $\\tan(\\alpha-\\frac{\\pi}{4})=\\frac{\\tan \\alpha-\\tan \\frac{\\pi}{4}}{1+\\tan \\alpha\\tan \\frac{\\pi}{4}}=\\frac{a-1}{1+a}=\\frac{1}{3}$，解得 $a=2$，所以 $\\tan \\alpha=2$。',
            knowledgeTags: [moduleName, tag, '三角函数', '正切', '两角差公式', '方程求值']
          };
        }
        if (index === 12) {
          return {
            prompt: '角 $\\beta$ 的终边过点 $P(-2,1)$，$\\tan \\beta=$（ ）',
            options: [
              { id: 'A', text: '2' },
              { id: 'B', text: '-2' },
              { id: 'C', text: '$\\frac{1}{2}$' },
              { id: 'D', text: '$-\\frac{1}{2}$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】由终边或终边上的点求三角函数值\n【分析】根据三角函数的定义求得正确答案。\n【详解】因为角 $\\beta$ 的终边经过点 $P(-2,1)$，所以 $\\tan \\beta=\\frac{1}{-2}=-\\frac{1}{2}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '正切', '终边', '坐标']
          };
        }
        if (index === 13) {
          return {
            prompt: '已知 $0<\\alpha<\\pi$，$\\cos \\frac{\\alpha}{2}=\\frac{\\sqrt{3}}{3}$，则 $\\cos \\alpha=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{4}{9}$' },
              { id: 'B', text: '$-\\frac{4}{9}$' },
              { id: 'C', text: '$\\frac{1}{3}$' },
              { id: 'D', text: '$-\\frac{1}{3}$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】二倍角的余弦公式\n【分析】根据余弦的二倍角公式，求出结果。\n【详解】由二倍角公式得 $\\cos \\alpha=2\\cos^2\\frac{\\alpha}{2}-1=2\\times(\\frac{\\sqrt{3}}{3})^2-1=-\\frac{1}{3}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '二倍角公式', '余弦', '化简求值']
          };
        }
        if (index === 14) {
          return {
            prompt: '若 $\\sin \\alpha=-\\frac{\\sqrt{5}}{6}$，则 $\\cos 2\\alpha=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{13}{18}$' },
              { id: 'B', text: '$-\\frac{13}{18}$' },
              { id: 'C', text: '$\\frac{\\sqrt{26}}{6}$' },
              { id: 'D', text: '$-\\frac{\\sqrt{26}}{6}$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】二倍角的余弦公式\n【分析】根据余弦二倍角公式直接计算即可。\n【详解】$\\cos 2\\alpha=1-2\\sin^2\\alpha=1-2\\times(-\\frac{\\sqrt{5}}{6})^2=\\frac{13}{18}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '二倍角公式', '余弦', '正弦']
          };
        }
        if (index === 15) {
          return {
            prompt: '若 $\\sin \\alpha=\\sqrt{2}\\cos \\alpha$，则 $\\tan \\alpha=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{\\sqrt{2}}{2}$' },
              { id: 'B', text: '$\\sqrt{2}$' },
              { id: 'C', text: '$-\\frac{\\sqrt{2}}{2}$' },
              { id: 'D', text: '$-\\sqrt{2}$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】已知弦（切）求切（弦）\n【分析】根据同角三角函数的基本关系计算可得。\n【详解】因为 $\\sin \\alpha=\\sqrt{2}\\cos \\alpha$，所以 $\\tan \\alpha=\\frac{\\sin \\alpha}{\\cos \\alpha}=\\sqrt{2}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '同角关系', '正切', '正弦余弦']
          };
        }
        if (index === 16) {
          return {
            prompt: '已知 $\\tan \\theta=-\\frac{1}{2}$，则 $\\frac{\\sin \\theta+\\cos \\theta}{\\sin \\theta-\\cos \\theta}=$（ ）',
            options: [
              { id: 'A', text: '3' },
              { id: 'B', text: '-3' },
              { id: 'C', text: '$\\frac{1}{3}$' },
              { id: 'D', text: '$-\\frac{1}{3}$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】正、余弦齐次式的计算\n【分析】根据条件，利用“齐次式”即可求解。\n【详解】因为 $\\tan \\theta=-\\frac{1}{2}$，则 $\\frac{\\sin \\theta+\\cos \\theta}{\\sin \\theta-\\cos \\theta}=\\frac{\\tan \\theta+1}{\\tan \\theta-1}=\\frac{-\\frac{1}{2}+1}{-\\frac{1}{2}-1}=-\\frac{1}{3}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '齐次式', '正弦余弦', '正切']
          };
        }
        if (index === 17) {
          return {
            prompt: '已知 $\\sin \\alpha=\\frac{1}{2}$，则 $\\sin(2\\pi+\\alpha)=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{\\sqrt{3}}{2}$' },
              { id: 'B', text: '$\\frac{1}{2}$' },
              { id: 'C', text: '$-\\frac{1}{2}$' },
              { id: 'D', text: '$-\\frac{\\sqrt{3}}{2}$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】诱导公式一\n【分析】根据诱导公式计算即可。\n【详解】因为 $\\sin \\alpha=\\frac{1}{2}$，则 $\\sin(2\\pi+\\alpha)=\\sin \\alpha=\\frac{1}{2}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '诱导公式', '正弦']
          };
        }
        if (index === 18) {
          return {
            prompt: '已知 $\\sin \\alpha=\\frac{3}{5}$，且 $\\alpha$ 为锐角，则 $\\cos \\alpha$ 的值为（ ）',
            options: [
              { id: 'A', text: '$\\frac{4}{5}$' },
              { id: 'B', text: '$-\\frac{4}{5}$' },
              { id: 'C', text: '$\\frac{3}{4}$' },
              { id: 'D', text: '$-\\frac{3}{4}$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】已知正（余）弦求余（正）弦\n【分析】根据同角平方关系求解。\n【详解】因为 $\\sin \\alpha=\\frac{3}{5}$，且 $\\alpha$ 为锐角，所以 $\\cos \\alpha=\\sqrt{1-\\sin^2\\alpha}=\\sqrt{1-(\\frac{3}{5})^2}=\\frac{4}{5}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '同角关系', '正弦', '余弦']
          };
        }
        if (index === 19) {
          return {
            prompt: '已知 $\\tan \\theta=6$，则 $\\frac{2\\cos \\theta-\\sin \\theta}{\\cos \\theta+\\sin \\theta}=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{7}{4}$' },
              { id: 'B', text: '$-\\frac{7}{4}$' },
              { id: 'C', text: '$\\frac{4}{7}$' },
              { id: 'D', text: '$-\\frac{4}{7}$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】正、余弦齐次式的计算\n【分析】分子分母为一次齐次式，分子分母同除以 $\\cos \\theta$ 转化为 $\\tan \\theta$ 的表达式，代入求解即可。\n【详解】因为 $\\cos \\theta\\ne0$，分子分母同除以 $\\cos \\theta$，$\\frac{2\\cos \\theta-\\sin \\theta}{\\cos \\theta+\\sin \\theta}=\\frac{2-\\tan \\theta}{1+\\tan \\theta}=\\frac{2-6}{1+6}=-\\frac{4}{7}$。',
            knowledgeTags: [moduleName, tag, '三角函数', '齐次式', '正弦余弦', '正切']
          };
        }
        const k = (n % 4) + 1;
        const b = n + 1;
        const x = n % 5;
        const variants = [
          () => question(`第 ${n} 组，函数 y=${k}x+${b}，当 x=${x} 时，y=（ ）`, `${k * x + b}`, [`${k + x + b}`, `${k * (x + b)}`, `${k * x - b}`], `一次函数代入自变量即可，y=${k}×${x}+${b}=${k * x + b}。`, [moduleName, tag, '函数值'], index),
          () => question(`第 ${n} 组，函数 y=1/(x-${k}) 的定义域应满足（ ）`, `x≠${k}`, [`x=${k}`, `x>${k}`, `x<${k}`], `分式分母不能为 0，因此 x-${k}≠0，得到 x≠${k}。`, [moduleName, tag, '定义域'], index),
          () => question(`第 ${n} 组，一次函数 y=${k}x+${b} 与 y 轴的交点是（ ）`, `(0, ${b})`, [`(${b}, 0)`, `(0, ${k})`, `(${k}, ${b})`], `与 y 轴相交时 x=0，代入得 y=${b}。`, [moduleName, tag, '函数图像'], index),
          () => question(`第 ${n} 组，指数函数 y=${k + 1}^x 的底数应满足（ ）`, `大于 0 且不等于 1`, ['只能等于 1', '必须小于 0', '可以为 0'], `指数函数 y=a^x 中，底数 a 需要满足 a>0 且 a≠1。`, [moduleName, tag, '指数函数'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('sequence')) {
        if (index === 0) {
          return {
            prompt: '若首项为 $2$ 的数列 $\\{a_n\\}$ 满足 $a_{n+1}=\\frac{a_n}{2}+\\frac{1}{2n-1}$，则 $a_4=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{4}{5}$' },
              { id: 'B', text: '$\\frac{13}{15}$' },
              { id: 'C', text: '$\\frac{14}{15}$' },
              { id: 'D', text: '$1$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】根据数列递推公式求数列的项\n【分析】直接根据递推关系逐项计算即可。\n【详解】因为 $a_1=2$，$a_{n+1}=\\frac{a_n}{2}+\\frac{1}{2n-1}$，\n当 $n=1$ 时，$a_2=\\frac{a_1}{2}+\\frac{1}{2\\times1-1}=1+1=2$；\n当 $n=2$ 时，$a_3=\\frac{a_2}{2}+\\frac{1}{2\\times2-1}=1+\\frac13=\\frac43$；\n当 $n=3$ 时，$a_4=\\frac{a_3}{2}+\\frac{1}{2\\times3-1}=\\frac23+\\frac15=\\frac{13}{15}$。因此答案为 B。',
            knowledgeTags: [moduleName, tag, '递推公式', '数列求项']
          };
        }
        if (index === 1) {
          return {
            prompt: '在等差数列 $\\{a_n\\}$ 中 $a_5=11$，$a_{11}=5$，则 $a_1$ 等于（ ）',
            options: [
              { id: 'A', text: '$-15$' },
              { id: 'B', text: '$15$' },
              { id: 'C', text: '$25$' },
              { id: 'D', text: '$-25$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】等差数列通项公式的基本量计算\n【分析】利用等差数列通项公式 $a_n=a_1+(n-1)d$，把已知的 $a_5$、$a_{11}$ 代入，先求公差 $d$，再求首项 $a_1$。\n【详解】由 $a_n=a_1+(n-1)d$，得\n$a_5=a_1+4d=11$，$a_{11}=a_1+10d=5$。\n两式相减：$(a_1+10d)-(a_1+4d)=5-11$，所以 $6d=-6$，$d=-1$。\n代回 $a_5=a_1+4d=11$，得 $a_1+4\\times(-1)=11$，所以 $a_1=15$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '等差数列', '通项公式', '首项', '公差']
          };
        }
        if (index === 2) {
          return {
            prompt: '数列 $\\frac{1}{3}$，$\\frac{3}{5}$，$\\frac{5}{7}$，$\\frac{7}{9}$，$\\frac{9}{11}$，$\\cdots$ 的一个通项公式是 $a_n=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{2n-3}{2n-1}$' },
              { id: 'B', text: '$\\frac{2n-1}{2n+1}$' },
              { id: 'C', text: '$\\frac{2n+1}{2n+3}$' },
              { id: 'D', text: '$\\frac{2n+3}{2n+5}$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】观察法求数列通项\n【分析】根据前 5 项的分子、分母变化规律，分别写出第 $n$ 项的分子和分母。\n【详解】该数列的分子为 $1,3,5,7,9,\\cdots$，是从 1 开始的连续奇数，第 $n$ 项分子为 $2n-1$；\n分母为 $3,5,7,9,11,\\cdots$，比对应分子大 2，第 $n$ 项分母为 $2n+1$。\n所以 $a_n=\\frac{2n-1}{2n+1}$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '观察法', '通项公式', '分式数列']
          };
        }
        if (index === 3) {
          return {
            prompt: '已知 $\\{a_n\\}$ 为等比数列，且 $a_1=3$，$q=2$，则 $S_6=$（ ）',
            options: [
              { id: 'A', text: '$189$' },
              { id: 'B', text: '$93$' },
              { id: 'C', text: '$63$' },
              { id: 'D', text: '$33$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】等比数列前 $n$ 项和的基本量计算\n【分析】应用等比数列前 $n$ 项和公式计算即可。\n【详解】因为 $\\{a_n\\}$ 为等比数列，且 $a_1=3$，$q=2$，\n所以 $S_6=\\frac{a_1(1-q^6)}{1-q}=\\frac{3(1-2^6)}{1-2}=3(2^6-1)=3\\times63=189$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '等比数列', '前n项和', '求和公式']
          };
        }
        if (index === 4) {
          return {
            prompt: '等差数列 $\\{a_n\\}$ 中，若 $a_1=12$，$a_7=36$，则公差 $d$ 的值为（ ）',
            options: [
              { id: 'A', text: '$\\frac{3}{2}$' },
              { id: 'B', text: '$2$' },
              { id: 'C', text: '$3$' },
              { id: 'D', text: '$4$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】等差数列通项公式的基本量计算\n【分析】根据等差数列通项公式 $a_n=a_1+(n-1)d$ 代入计算即可。\n【详解】由 $a_7=a_1+6d$，得 $36=12+6d$，所以 $6d=24$，解得 $d=4$。\n故选 D。',
            knowledgeTags: [moduleName, tag, '等差数列', '通项公式', '公差']
          };
        }
        if (index === 5) {
          return {
            prompt: '设 $S_n$ 为等差数列 $\\{a_n\\}$ 的前 $n$ 项和，已知 $S_9=72$，则 $a_5$ 的值为（ ）',
            options: [
              { id: 'A', text: '$12$' },
              { id: 'B', text: '$10$' },
              { id: 'C', text: '$9$' },
              { id: 'D', text: '$8$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】求等差数列前 $n$ 项和，利用等差数列的性质计算\n【分析】等差数列中，奇数个连续项的平均数等于中间项，因此前 9 项和等于 $9a_5$。\n【详解】由等差数列性质可得 $a_1+a_9=2a_5$，\n所以 $S_9=\\frac{(a_1+a_9)\\times9}{2}=9a_5$。\n又 $S_9=72$，因此 $9a_5=72$，解得 $a_5=8$。\n故选 D。',
            knowledgeTags: [moduleName, tag, '等差数列', '前n项和', '中项性质']
          };
        }
        if (index === 6) {
          return {
            prompt: '已知数列 $\\{a_n\\}$ 为等差数列，若 $a_3+a_7=12$，则 $a_5$ 为（ ）',
            options: [
              { id: 'A', text: '$4$' },
              { id: 'B', text: '$5$' },
              { id: 'C', text: '$6$' },
              { id: 'D', text: '$7$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】等差中项的应用\n【分析】在等差数列中，位置对称的两项之和等于中间项的 2 倍。\n【详解】因为 $3$ 和 $7$ 关于 $5$ 对称，所以在等差数列中有 $a_3+a_7=2a_5$。\n已知 $a_3+a_7=12$，因此 $2a_5=12$，解得 $a_5=6$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '等差数列', '等差中项', '对称项']
          };
        }
        if (index === 7) {
          return {
            prompt: '等比数列 $\\{a_n\\}$ 满足 $a_{1013}=5$，则 $a_1a_{2025}=$（ ）',
            options: [
              { id: 'A', text: '$\\sqrt{5}$' },
              { id: 'B', text: '$5$' },
              { id: 'C', text: '$10$' },
              { id: 'D', text: '$25$' }
            ],
            correctAnswer: 'D',
            explanation: '【知识点】等比数列下标和性质及应用\n【分析】在等比数列中，若两个项的下标和相等，则对应项的乘积相等。这里 $1+2025=2\\times1013$，所以 $a_1$ 与 $a_{2025}$ 关于 $a_{1013}$ 对称。\n【详解】在等比数列 $\\{a_n\\}$ 中，因为 $1+2025=2026=2\\times1013$，所以 $a_1a_{2025}=a_{1013}^2$。\n又 $a_{1013}=5$，因此 $a_1a_{2025}=5^2=25$。\n故选 D。',
            knowledgeTags: [moduleName, tag, '等比数列', '下标和性质', '对称项']
          };
        }
        if (index === 8) {
          return {
            prompt: '已知等差数列 $\\{a_n\\}$ 满足 $a_3+a_8=a_6$，则下列各式正确的是（ ）',
            options: [
              { id: 'A', text: '$a_4=0$' },
              { id: 'B', text: '$a_5=0$' },
              { id: 'C', text: '$a_6=0$' },
              { id: 'D', text: '$a_7=0$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】等差数列通项公式的基本量计算\n【分析】利用等差数列的通项公式 $a_n=a_1+(n-1)d$ 代入已知条件求解。\n【详解】设等差数列 $\\{a_n\\}$ 的公差为 $d$，则\n$a_3=a_1+2d$，$a_8=a_1+7d$，$a_6=a_1+5d$。\n由 $a_3+a_8=a_6$，得 $(a_1+2d)+(a_1+7d)=a_1+5d$，\n化简得 $a_1+4d=0$。\n又 $a_5=a_1+4d$，所以 $a_5=0$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '等差数列', '通项公式', '公差']
          };
        }
        if (index === 9) {
          return {
            prompt: '已知 $S_n$ 是等差数列 $\\{a_n\\}$ 的前 $n$ 项和，若 $a_2+a_{10}=10$，则 $S_{11}=$（ ）',
            options: [
              { id: 'A', text: '$33$' },
              { id: 'B', text: '$44$' },
              { id: 'C', text: '$55$' },
              { id: 'D', text: '$66$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】求等差数列前 $n$ 项和，利用等差数列的性质计算\n【分析】根据等差数列下标和相等时对应项和相等，再结合前 $n$ 项和公式计算。\n【详解】在等差数列中，因为 $1+11=2+10=12$，所以 $a_1+a_{11}=a_2+a_{10}$。\n已知 $a_2+a_{10}=10$，因此 $a_1+a_{11}=10$。\n所以 $S_{11}=\\frac{11}{2}(a_1+a_{11})=\\frac{11}{2}\\times10=55$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '等差数列', '前n项和', '下标和性质']
          };
        }
        if (index === 10) {
          return {
            prompt: '已知等差数列 $\\{a_n\\}$ 满足 $a_6+a_7+a_8=9$，则 $a_7$ 等于（ ）',
            options: [
              { id: 'A', text: '$9$' },
              { id: 'B', text: '$6$' },
              { id: 'C', text: '$3$' },
              { id: 'D', text: '$2$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】等差中项的应用，利用等差数列的性质计算\n【分析】$a_6$、$a_7$、$a_8$ 是等差数列中的连续三项，其中 $a_7$ 是 $a_6$ 与 $a_8$ 的等差中项。\n【详解】由等差数列性质可知 $a_6+a_8=2a_7$，\n所以 $a_6+a_7+a_8=2a_7+a_7=3a_7$。\n已知 $a_6+a_7+a_8=9$，因此 $3a_7=9$，解得 $a_7=3$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '等差数列', '等差中项', '连续三项']
          };
        }
        if (index === 11) {
          return {
            prompt: '数列 $\\frac{1}{2}$，$\\frac{2}{5}$，$\\frac{3}{10}$，$\\frac{4}{17}$，$\\cdots$ 的通项公式为 $a_n=$（ ）',
            options: [
              { id: 'A', text: '$\\frac{n}{n+1}$' },
              { id: 'B', text: '$\\frac{n}{n^2+1}$' },
              { id: 'C', text: '$\\frac{n+1}{n^2+1}$' },
              { id: 'D', text: '$\\frac{n}{n^2+2}$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】观察法求数列通项\n【分析】根据给定数列前 4 项，分别观察分子与分母的规律。\n【详解】该数列可写为\n$\\frac{1}{2}=\\frac{1}{1^2+1}$，$\\frac{2}{5}=\\frac{2}{2^2+1}$，$\\frac{3}{10}=\\frac{3}{3^2+1}$，$\\frac{4}{17}=\\frac{4}{4^2+1}$，$\\cdots$\n可见第 $n$ 项分子为 $n$，分母为 $n^2+1$。\n所以 $a_n=\\frac{n}{n^2+1}$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '观察法', '通项公式', '分式数列']
          };
        }
        if (index === 12) {
          return {
            prompt: '已知等差数列 $\\{a_n\\}$ 的第二项和第三项分别为 $3,1$，则第 $5$ 项的值为（ ）',
            options: [
              { id: 'A', text: '$-3$' },
              { id: 'B', text: '$-2$' },
              { id: 'C', text: '$2$' },
              { id: 'D', text: '$-6$' }
            ],
            correctAnswer: 'A',
            explanation: '【知识点】等差数列通项公式的基本量计算，利用等差数列通项公式求数列中的项\n【分析】设公差为 $d$，根据第二项、第三项求出 $d$，再代入求第 5 项。\n【详解】由题意，$a_2=3$，$a_3=1$，设公差为 $d$，则\n$d=a_3-a_2=1-3=-2$。\n因为 $a_5=a_3+2d$，所以 $a_5=1+2\\times(-2)=-3$。\n故选 A。',
            knowledgeTags: [moduleName, tag, '等差数列', '通项公式', '公差']
          };
        }
        if (index === 13) {
          return {
            prompt: '已知数列 $\\{a_n\\}$ 为等比数列，$a_1a_4a_7=64$，$a_6a_7=8$，则 $a_9=$（ ）',
            options: [
              { id: 'A', text: '$1$' },
              { id: 'B', text: '$2$' },
              { id: 'C', text: '$4$' },
              { id: 'D', text: '$6$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】等比数列下标和性质及应用\n【分析】由等比数列的性质先求出 $a_4$，再由 $a_6a_7=a_4a_9$ 求出 $a_9$。\n【详解】在等比数列中，因为 $1,4,7$ 关于 $4$ 对称，所以 $a_1a_7=a_4^2$。\n因此 $a_1a_4a_7=a_4^3=64$，解得 $a_4=4$。\n又因为 $6+7=4+9=13$，所以 $a_6a_7=a_4a_9$。\n已知 $a_6a_7=8$，于是 $4a_9=8$，解得 $a_9=2$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '等比数列', '下标和性质', '对称项']
          };
        }
        if (index === 14) {
          return {
            prompt: '在等差数列 $\\{a_n\\}$ 中，$a_3+a_5=20$，则 $a_4=$（ ）',
            options: [
              { id: 'A', text: '$20$' },
              { id: 'B', text: '$15$' },
              { id: 'C', text: '$10$' },
              { id: 'D', text: '$5$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】利用等差数列的性质计算\n【分析】利用等差数列下标和相等时对应项和相等的性质即可求解。\n【详解】在等差数列中，因为 $3+5=4+4$，所以 $a_3+a_5=2a_4$。\n已知 $a_3+a_5=20$，因此 $2a_4=20$，解得 $a_4=10$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '等差数列', '等差中项', '下标和性质']
          };
        }
        if (index === 15) {
          return {
            prompt: '已知等差数列 $\\{a_n\\}$ 的前 $n$ 项和为 $S_n$，$a_3=1$，$a_2+a_8=6$，则 $a_1=$（ ）',
            options: [
              { id: 'A', text: '$0$' },
              { id: 'B', text: '$-1$' },
              { id: 'C', text: '$-2$' },
              { id: 'D', text: '$-3$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】等差数列通项公式的基本量计算，等差中项的应用\n【分析】先利用等差数列下标和性质求出 $a_5$，再由 $a_3$ 与 $a_5$ 求公差，最后求 $a_1$。\n【详解】因为 $2+8=5+5$，所以 $a_2+a_8=2a_5$。\n已知 $a_2+a_8=6$，因此 $2a_5=6$，得 $a_5=3$。\n又 $a_3=1$，所以公差 $d=\\frac{a_5-a_3}{5-3}=\\frac{3-1}{2}=1$。\n由 $a_3=a_1+2d$，得 $1=a_1+2\\times1$，所以 $a_1=-1$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '等差数列', '通项公式', '等差中项', '公差']
          };
        }
        if (index === 16) {
          return {
            prompt: '等差数列 $\\{a_n\\}$ 中，$a_3+a_7=10$，则 $a_5=$（ ）',
            options: [
              { id: 'A', text: '$4$' },
              { id: 'B', text: '$5$' },
              { id: 'C', text: '$6$' },
              { id: 'D', text: '$7$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】利用等差数列的性质计算\n【分析】直接根据等差数列下标和相等时对应项和相等的性质求解。\n【详解】在等差数列中，因为 $3+7=5+5$，所以 $a_3+a_7=2a_5$。\n已知 $a_3+a_7=10$，因此 $2a_5=10$，解得 $a_5=5$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '等差数列', '等差中项', '下标和性质']
          };
        }
        if (index === 17) {
          return {
            prompt: '已知等差数列 $\\{a_n\\}$ 中，$a_4+a_7=8$，则前 $10$ 项和 $S_{10}$ 的值为（ ）',
            options: [
              { id: 'A', text: '$80$' },
              { id: 'B', text: '$40$' },
              { id: 'C', text: '$20$' },
              { id: 'D', text: '$10$' }
            ],
            correctAnswer: 'B',
            explanation: '【知识点】求等差数列前 $n$ 项和，利用等差数列的性质计算\n【分析】利用等差数列的项的性质与求和公式计算即可。\n【详解】因为 $\\{a_n\\}$ 是等差数列，且 $4+7=1+10=11$，所以 $a_4+a_7=a_1+a_{10}$。\n已知 $a_4+a_7=8$，因此 $a_1+a_{10}=8$。\n所以 $S_{10}=\\frac{10(a_1+a_{10})}{2}=5\\times8=40$。\n故选 B。',
            knowledgeTags: [moduleName, tag, '等差数列', '前n项和', '下标和性质']
          };
        }
        if (index === 18) {
          return {
            prompt: '已知等差数列 $\\{a_n\\}$ 满足 $a_1+a_5+a_7+a_{11}=36$，则 $a_6=$（ ）',
            options: [
              { id: 'A', text: '$7$' },
              { id: 'B', text: '$8$' },
              { id: 'C', text: '$9$' },
              { id: 'D', text: '$10$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】等差中项的应用\n【分析】根据等差数列中对称项的性质，把四项和转化为 $a_6$ 的倍数。\n【详解】因为 $1+11=6+6$，所以 $a_1+a_{11}=2a_6$；\n又因为 $5+7=6+6$，所以 $a_5+a_7=2a_6$。\n因此 $a_1+a_5+a_7+a_{11}=4a_6$。\n已知四项和为 $36$，所以 $4a_6=36$，解得 $a_6=9$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '等差数列', '等差中项', '对称项']
          };
        }
        if (index === 19) {
          return {
            prompt: '已知数列 $1,4,9,16,\\cdots$，则它的通项公式可能是（ ）',
            options: [
              { id: 'A', text: '$a_n=\\ln\\frac{1}{n}$' },
              { id: 'B', text: '$a_n=2^{-n}$' },
              { id: 'C', text: '$a_n=n^2$' },
              { id: 'D', text: '$a_n=3-n$' }
            ],
            correctAnswer: 'C',
            explanation: '【知识点】观察法求数列通项\n【分析】根据所给数据，分析规律即可得答案。\n【详解】数列 $1,4,9,16,\\cdots$ 可写成 $1^2,2^2,3^2,4^2,\\cdots$，\n因此它的通项公式可能为 $a_n=n^2$。\n故选 C。',
            knowledgeTags: [moduleName, tag, '观察法', '通项公式', '平方数列']
          };
        }
        const first = n;
        const diff = (n % 4) + 2;
        const term = 6;
        const answer = first + (term - 1) * diff;
        const ratio = (n % 3) + 2;
        const variants = [
          () => question(`第 ${n} 组，等差数列首项为 ${first}，公差为 ${diff}，第 ${term} 项为（ ）`, `${answer}`, [`${answer + diff}`, `${first + term * diff}`, `${answer - diff}`], `等差数列通项 a_n=a_1+(n-1)d，代入 a_1=${first}、d=${diff}、n=${term} 得 ${answer}。`, [moduleName, tag, '等差数列'], index),
          () => question(`第 ${n} 组，等比数列首项为 ${first}，公比为 ${ratio}，第 3 项为（ ）`, `${first * ratio * ratio}`, [`${first + ratio + ratio}`, `${first * ratio}`, `${first * 3 * ratio}`], `等比数列 a_n=a_1q^(n-1)，第 3 项是 ${first}×${ratio}²=${first * ratio * ratio}。`, [moduleName, tag, '等比数列'], index),
          () => question(`第 ${n} 组，等差数列前 5 项为 ${first}，${first + diff}，...，其公差是（ ）`, `${diff}`, [`${first}`, `${first + diff}`, `${diff + 1}`], `相邻两项差相等，第二项减第一项为 ${diff}。`, [moduleName, tag, '公差'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('calculus')) {
        const a = (n % 4) + 1;
        const x = (n % 5) + 1;
        const variants = [
          () => question(`第 ${n} 组，函数 f(x)=${a}x² 的导数 f'(x) 为（ ）`, `${2 * a}x`, [`${a}x`, `${a}x²`, `${2 * a}`], `幂函数求导公式为 (x²)'=2x，因此 (${a}x²)'=${2 * a}x。`, [moduleName, tag, '导数'], index),
          () => question(`第 ${n} 组，若 f'(x)=2x，则 f(x) 在 x=${x} 处的切线斜率是（ ）`, `${2 * x}`, [`${x}`, `${x * x}`, `${2 + x}`], `导数值表示切线斜率，代入 x=${x} 得 ${2 * x}。`, [moduleName, tag, '切线斜率'], index),
          () => question(`第 ${n} 组，用矩形近似曲线下面积时，把区间分得越细，近似值通常（ ）`, '越接近真实面积', ['一定变为 0', '一定变大一倍', '与函数无关'], `定积分可以理解为无限细分后的面积极限，分割越细通常越接近真实值。`, [moduleName, tag, '积分思想'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('probability')) {
        const red = (n % 5) + 1;
        const total = red + 5 + n;
        const nums = [n, n + 2, n + 4];
        const avg = n + 2;
        const variants = [
          () => question(`第 ${n} 组，袋中有 ${total} 个球，其中 ${red} 个红球，随机取 1 个为红球的概率是（ ）`, `${red}/${total}`, [`${total - red}/${total}`, `1/${total}`, `${red}/${total + red}`], `每个球被取到的可能性相同，概率=红球数/总球数，因此为 ${red}/${total}。`, [moduleName, tag, '古典概型'], index),
          () => question(`第 ${n} 组，数据 ${nums.join('，')} 的平均数是（ ）`, `${avg}`, [`${avg + 1}`, `${avg - 1}`, `${avg * 3}`], `平均数为数据总和除以个数，即 ${(nums.reduce((a, b) => a + b, 0))}/3=${avg}。`, [moduleName, tag, '平均数'], index),
          () => question(`第 ${n} 组，抛一枚均匀硬币 1 次，出现正面的概率是（ ）`, '1/2', ['1/3', '1', '0'], `均匀硬币只有正反两种等可能结果，正面占 1 种，因此概率为 1/2。`, [moduleName, tag, '等可能事件'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('complex')) {
        const a = n;
        const b = n + 2;
        const variants = [
          () => question(`第 ${n} 组，复数 z=${a}+${b}i 的实部是（ ）`, `${a}`, [`${b}`, `${a + b}`, 'i'], `复数 a+bi 中 a 为实部，b 为虚部。`, [moduleName, tag, '复数形式'], index),
          () => question(`第 ${n} 组，(${a}+${b}i)+(${b}+${a}i)=（ ）`, `${a + b}+${a + b}i`, [`${a + b}`, `${a * b}i`, `${a - b}+${b - a}i`], `复数加法实部与实部相加、虚部与虚部相加。`, [moduleName, tag, '复数加法'], index),
          () => question(`第 ${n} 组，复数 z=${a}+0i 可看作（ ）`, '实数', ['纯虚数', '无理数', '不能表示'], `虚部为 0 的复数就是实数。`, [moduleName, tag, '实数与复数'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('solid-geometry')) {
        const side = (n % 5) + 2;
        const radius = (n % 4) + 1;
        const height = n + 3;
        const variants = [
          () => question(`第 ${n} 组，棱长为 ${side} 的正方体体积是（ ）`, `${side ** 3}`, [`${side * side}`, `${6 * side * side}`, `${3 * side}`], `正方体体积 V=a³，代入 a=${side} 得 ${side ** 3}。`, [moduleName, tag, '正方体体积'], index),
          () => question(`第 ${n} 组，半径为 ${radius}、高为 ${height} 的圆柱体积是（ ）`, `${radius * radius * height}π`, [`${2 * radius * height}π`, `${radius * height}π`, `${radius * radius}π`], `圆柱体积 V=πr²h，代入得到 ${radius * radius * height}π。`, [moduleName, tag, '圆柱体积'], index),
          () => question(`第 ${n} 组，球的表面积公式是（ ）`, 'S=4πr²', ['S=πr²', 'S=2πr', 'S=πr²h'], `球的表面积为 4πr²，体积为 4/3πr³。`, [moduleName, tag, '球体表面积'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('coordinate-geometry')) {
        const x1 = n;
        const y1 = n + 1;
        const z1 = n + 2;
        const x2 = n + 2;
        const y2 = n + 3;
        const z2 = n + 4;
        const variants = [
          () => question(`第 ${n} 组，空间点 A(${x1},${y1},${z1}) 与 B(${x2},${y2},${z2}) 的中点坐标是（ ）`, `(${(x1 + x2) / 2}, ${(y1 + y2) / 2}, ${(z1 + z2) / 2})`, [`(${x1 + x2}, ${y1 + y2}, ${z1 + z2})`, `(${x2 - x1}, ${y2 - y1}, ${z2 - z1})`, `(${x1}, ${y2}, ${z1})`], `空间中点坐标按三个坐标分别取平均。`, [moduleName, tag, '空间中点'], index),
          () => question(`第 ${n} 组，点 P(${x1},${y1},${z1}) 到原点距离的平方是（ ）`, `${x1 * x1 + y1 * y1 + z1 * z1}`, [`${x1 + y1 + z1}`, `${x1 * y1 * z1}`, `${x1 * x1 + y1 * y1}`], `空间距离平方为 x²+y²+z²。`, [moduleName, tag, '空间距离'], index),
          () => question(`第 ${n} 组，空间直角坐标系中，一个点通常需要（ ）个坐标确定`, '3', ['1', '2', '4'], `三维空间点由 x、y、z 三个坐标确定。`, [moduleName, tag, '坐标表示'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('geometry') || topicSlug.includes('vector')) {
        if (topicSlug.includes('vector')) {
          const ax = n;
          const ay = n + 1;
          const bx = 2;
          const by = n + 3;
          const variants = [
            () => question(`第 ${n} 组，向量 a=(${ax},${ay})，b=(${bx},${by})，则 a+b=（ ）`, `(${ax + bx}, ${ay + by})`, [`(${ax - bx}, ${ay - by})`, `(${ax * bx}, ${ay * by})`, `(${bx}, ${ay})`], `向量加法按坐标分别相加，因此 a+b=(${ax}+${bx}, ${ay}+${by})。`, [moduleName, tag, '向量加法'], index),
            () => question(`第 ${n} 组，向量 a=(${ax},${ay})，b=(${bx},${by})，则 a·b=（ ）`, `${ax * bx + ay * by}`, [`${ax + ay + bx + by}`, `${ax * by - ay * bx}`, `${ax * bx}`], `数量积按对应坐标乘积求和，a·b=${ax}×${bx}+${ay}×${by}。`, [moduleName, tag, '数量积'], index),
            () => question(`第 ${n} 组，零向量的特点是（ ）`, '长度为 0', ['方向唯一', '长度为 1', '不能参与加法'], `零向量长度为 0，和任意向量相加仍保持原向量。`, [moduleName, tag, '零向量'], index)
          ];
          return variants[index % variants.length]();
        }
        const x1 = n;
        const y1 = n + 2;
        const x2 = n + 4;
        const y2 = n + 6;
        const variants = [
          () => question(`第 ${n} 组，点 A(${x1},${y1}) 与 B(${x2},${y2}) 的中点坐标是（ ）`, `(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`, [`(${x1 + x2}, ${y1 + y2})`, `(${x2 - x1}, ${y2 - y1})`, `(${x1}, ${y2})`], `线段中点坐标为横坐标平均、纵坐标平均，分别计算即可。`, [moduleName, tag, '中点坐标'], index),
          () => question(`第 ${n} 组，过点 A(${x1},${y1})、B(${x2},${y2}) 的直线斜率是（ ）`, `${(y2 - y1) / (x2 - x1)}`, [`${y2 - y1}`, `${x2 - x1}`, `${(x2 - x1) / (y2 - y1)}`], `斜率 k=(y₂-y₁)/(x₂-x₁)=${y2 - y1}/${x2 - x1}。`, [moduleName, tag, '斜率'], index),
          () => question(`第 ${n} 组，圆 (x-${x1})²+(y-${y1})²=${n + 4} 的圆心是（ ）`, `(${x1}, ${y1})`, [`(${n + 4}, ${y1})`, `(${-x1}, ${-y1})`, `(0, 0)`], `标准方程 (x-a)²+(y-b)²=r² 的圆心是 (a,b)。`, [moduleName, tag, '圆的方程'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('statistics')) {
        const nums = [n, n + 2, n + 4];
        const avg = n + 2;
        return question(`数据 ${nums.join('，')} 的平均数是（ ）`, `${avg}`, [`${avg + 1}`, `${avg - 1}`, `${avg * 3}`], `平均数为数据总和除以个数，即 ${(nums.reduce((a, b) => a + b, 0))}/3=${avg}。`, [moduleName, tag, '平均数'], index);
      }
      return question(`设集合 A={1,2,${n + 2}}，B={2,${n + 2},${n + 3}}，则 A∩B=（ ）`, `{2, ${n + 2}}`, [`{1, ${n + 3}}`, `{1,2,${n + 2},${n + 3}}`, `{${n + 3}}`], `交集由两个集合共有元素组成，逐项比对两个集合即可。`, [moduleName, tag, '交集'], index);
    }

    if (subjectId === 'physics') {
      const expandedPhysicsQuestion = buildExpandedPhysicsQuestion(moduleName, topicTitle, topicSlug, index);
      if (expandedPhysicsQuestion) return expandedPhysicsQuestion;
      if (topicSlug.includes('force')) {
        const f = (n + 2) * 3;
        const m = 3;
        return question(`质量为 ${m} kg 的物体受合力 ${f} N，加速度大小为（ ）`, `${f / m} m/s²`, [`${f + m} m/s²`, `${f * m} m/s²`, `${m / f} m/s²`], `由牛顿第二定律 F=ma，a=F/m=${f}/${m}。`, [moduleName, tag, '牛顿第二定律'], index);
      }
      if (topicSlug.includes('motion')) {
        const v = n + 4;
        const t = n + 2;
        return question(`物体做匀速直线运动，速度为 ${v} m/s，运动 ${t} s 的位移是（ ）`, `${v * t} m`, [`${v + t} m`, `${v / t} m`, `${v * t * 2} m`], `匀速直线运动位移 s=vt，代入速度和时间得 ${v * t} m。`, [moduleName, tag, '匀速运动'], index);
      }
      if (topicSlug.includes('work-energy')) {
        const f = n + 8;
        const s = n + 2;
        const m = 2;
        const v = n + 3;
        const variants = [
          () => question(`水平恒力 ${f} N 使物体沿力的方向移动 ${s} m，力做的功为（ ）`, `${f * s} J`, [`${f + s} J`, `${f / s} J`, `${2 * f * s} J`], `恒力做功 W=Fs，力和位移同向时直接相乘。`, [moduleName, tag, '功'], index),
          () => question(`质量 ${m} kg 的物体速度为 ${v} m/s，其动能为（ ）`, `${m * v * v / 2} J`, [`${m * v} J`, `${m * v * v} J`, `${v * v / 2} J`], `动能 E_k=1/2mv²，代入即可。`, [moduleName, tag, '动能'], index),
          () => question(`第 ${n} 组，只有重力做功时，机械能通常（ ）`, '保持守恒', ['一定增加', '一定减少', '变为零'], `只有保守力做功且忽略阻力时，动能和势能相互转化，机械能守恒。`, [moduleName, tag, '机械能守恒'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('circular') || topicSlug.includes('gravity')) {
        const r = n + 2;
        const v = n + 3;
        const variants = [
          () => question(`物体做匀速圆周运动，线速度为 ${v} m/s，半径为 ${r} m，向心加速度为（ ）`, `${v * v}/${r} m/s²`, [`${v}/${r} m/s²`, `${v * r} m/s²`, `${r}/${v} m/s²`], `向心加速度 a=v²/r，代入线速度和半径即可。`, [moduleName, tag, '向心加速度'], index),
          () => question(`第 ${n} 组，匀速圆周运动中，合力方向始终指向（ ）`, '圆心', ['切线方向', '运动反方向', '竖直向上'], `向心力总是指向圆心，用来改变速度方向。`, [moduleName, tag, '向心力'], index),
          () => question(`第 ${n} 组，万有引力大小与两物体质量乘积成（ ）`, '正比', ['反比', '无关', '平方反比'], `万有引力 F=Gm₁m₂/r²，与质量乘积成正比。`, [moduleName, tag, '万有引力'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('momentum')) {
        const m = n + 1;
        const v = 3;
        const f = n + 5;
        const t = 2;
        const variants = [
          () => question(`质量 ${m} kg 的物体以 ${v} m/s 运动，其动量大小为（ ）`, `${m * v} kg·m/s`, [`${m + v} kg·m/s`, `${m / v} kg·m/s`, `${v / m} kg·m/s`], `动量 p=mv，代入质量和速度即可。`, [moduleName, tag, '动量'], index),
          () => question(`恒力 ${f} N 作用 ${t} s，冲量大小为（ ）`, `${f * t} N·s`, [`${f + t} N·s`, `${f / t} N·s`, `${t / f} N·s`], `冲量 I=Ft，方向与力方向一致。`, [moduleName, tag, '冲量'], index),
          () => question(`第 ${n} 组，两个物体组成的系统不受外力时，总动量通常（ ）`, '保持守恒', ['一定增加', '一定减小', '变成零'], `系统合外力为零时，总动量守恒。`, [moduleName, tag, '动量守恒'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('electrostatic')) {
        const q = n + 1;
        const e = 4;
        const variants = [
          () => question(`电荷量为 ${q} C 的电荷在电场强度 ${e} N/C 的电场中受到的电场力为（ ）`, `${q * e} N`, [`${q + e} N`, `${q / e} N`, `${e / q} N`], `电场力 F=qE，代入电荷量和电场强度即可。`, [moduleName, tag, '电场力'], index),
          () => question(`第 ${n} 组，电场强度的方向规定为（ ）在电场中受力方向`, '正电荷', ['负电荷', '中子', '任意物体'], `电场强度方向按正试探电荷所受电场力方向规定。`, [moduleName, tag, '电场强度'], index),
          () => question(`第 ${n} 组，同种电荷之间通常（ ）`, '相互排斥', ['相互吸引', '没有作用', '先吸引后排斥'], `同种电荷相互排斥，异种电荷相互吸引。`, [moduleName, tag, '电荷作用'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('circuit')) {
        const r = n + 4;
        const i = 2;
        return question(`电阻 ${r} Ω 中通过电流 ${i} A，两端电压为（ ）`, `${r * i} V`, [`${r + i} V`, `${r / i} V`, `${r * i * i} V`], `欧姆定律 U=IR，电压等于电流与电阻的乘积。`, [moduleName, tag, '欧姆定律'], index);
      }
      if (topicSlug.includes('induction')) {
        const variants = [
          () => question(`第 ${n} 组，闭合线圈中的磁通量发生变化时，线圈中会产生（ ）`, '感应电流', ['静电场', '恒定电阻', '机械波'], `电磁感应的关键条件是穿过闭合回路的磁通量发生变化。`, [moduleName, tag, '电磁感应'], index),
          () => question(`第 ${n} 组，感应电流方向通常可用（ ）判断`, '楞次定律', ['牛顿第一定律', '折射定律', '分子动理论'], `楞次定律说明感应电流的磁场总要阻碍引起感应电流的磁通量变化。`, [moduleName, tag, '楞次定律'], index),
          () => question(`第 ${n} 组，法拉第电磁感应定律描述感应电动势与（ ）变化率有关`, '磁通量', ['温度', '质量', '光强'], `感应电动势大小与磁通量变化率有关。`, [moduleName, tag, '法拉第电磁感应定律'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('magnetic')) {
        const variants = [
          () => question(`第 ${n} 次实验中，通电导线在磁场中受力方向通常可用（ ）判断`, '左手定则', ['右手螺旋定则', '能量守恒定律', '光的反射定律'], '安培力方向与电流方向、磁场方向有关，常用左手定则判断。', [moduleName, tag, '安培力'], index),
          () => question(`线圈实验 ${n} 中，闭合线圈的磁通量发生变化时，线圈中会产生（ ）`, '感应电流', ['恒定电阻', '静电平衡', '机械波'], '电磁感应的条件是穿过闭合回路的磁通量发生变化。', [moduleName, tag, '电磁感应'], index),
          () => question(`观察第 ${n} 个条形磁铁模型，磁铁外部磁感线方向是（ ）`, '从 N 极指向 S 极', ['从 S 极指向 N 极', '没有方向', '总是垂直地面'], '磁体外部磁感线由 N 极出发，回到 S 极。', [moduleName, tag, '磁感线'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('harmonic') || topicSlug.includes('wave')) {
        const f = n + 1;
        const lambda = 2;
        const variants = [
          () => question(`机械波频率为 ${f} Hz，波长为 ${lambda} m，波速为（ ）`, `${f * lambda} m/s`, [`${f + lambda} m/s`, `${f / lambda} m/s`, `${lambda / f} m/s`], `波速 v=fλ，频率与波长相乘即可。`, [moduleName, tag, '波速'], index),
          () => question(`第 ${n} 组，简谐振动完成一次全振动所需时间称为（ ）`, '周期', ['频率', '振幅', '波长'], `周期表示完成一次完整振动所用的时间。`, [moduleName, tag, '周期'], index),
          () => question(`第 ${n} 组，机械波传播的是（ ）`, '振动形式和能量', ['介质整体迁移', '静电荷', '温度本身'], `机械波传播振动形式和能量，介质质点只在平衡位置附近振动。`, [moduleName, tag, '机械波'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('geometric-optics')) {
        const variants = [
          () => question(`第 ${n} 组，光从空气斜射入水中时，折射光线通常向（ ）偏折`, '法线', ['界面', '入射光反方向', '任意方向'], `从光疏介质进入光密介质时，折射光线向法线偏折。`, [moduleName, tag, '折射'], index),
          () => question(`第 ${n} 组，平面镜成像的特点是（ ）`, '正立、等大、虚像', ['倒立、放大、实像', '正立、缩小、实像', '倒立、等大、实像'], `平面镜成正立、等大、左右相反的虚像。`, [moduleName, tag, '平面镜成像'], index),
          () => question(`第 ${n} 组，凸透镜成实像时，物体通常位于（ ）`, '焦点以外', ['焦点以内', '透镜中心', '任意位置'], `物距大于焦距时，凸透镜可以成实像。`, [moduleName, tag, '凸透镜成像'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('physical-optics')) {
        const variants = [
          () => question(`第 ${n} 组，双缝干涉现象主要说明光具有（ ）`, '波动性', ['粒子性唯一', '机械性', '热传导性'], `干涉是波特有的重要现象，说明光具有波动性。`, [moduleName, tag, '干涉'], index),
          () => question(`第 ${n} 组，光遇到障碍物边缘发生明显偏离直线传播的现象称为（ ）`, '衍射', ['折射', '反射', '电磁感应'], `波绕过障碍或孔继续传播的现象称为衍射。`, [moduleName, tag, '衍射'], index),
          () => question(`第 ${n} 组，偏振现象说明光波是（ ）`, '横波', ['纵波', '机械波', '声波'], `只有横波具有偏振现象，光的偏振说明光是横波。`, [moduleName, tag, '偏振'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('thermal')) {
        const c = 4;
        const m = n;
        const dt = 5;
        return question(`物体吸热 Q=cmΔt，c=${c}，m=${m}，Δt=${dt}，则 Q=（ ）`, `${c * m * dt}`, [`${c + m + dt}`, `${c * m}`, `${m * dt}`], `热量公式 Q=cmΔt，三个量相乘得到 ${c * m * dt}。`, [moduleName, tag, '比热容'], index);
      }
      if (topicSlug.includes('ideal-gas')) {
        const variants = [
          () => question(`第 ${n} 组，一定量理想气体温度不变时，压强与体积通常成（ ）`, '反比', ['正比', '无关', '平方正比'], `等温过程中 pV 为常量，压强与体积成反比。`, [moduleName, tag, '玻意耳定律'], index),
          () => question(`第 ${n} 组，理想气体状态方程常写作（ ）`, 'pV=nRT', ['F=ma', 'U=IR', 'v=fλ'], `理想气体状态方程联系压强、体积、物质的量和温度。`, [moduleName, tag, '理想气体状态方程'], index),
          () => question(`第 ${n} 组，理想气体状态方程中的 T 应使用（ ）`, '热力学温度', ['摄氏温度', '华氏温度', '任意数字'], `状态方程中的温度应为热力学温度，单位 K。`, [moduleName, tag, '热力学温度'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('molecular')) {
        const variants = [
          () => question(`第 ${n} 组，温度升高通常表示分子平均动能（ ）`, '增大', ['减小', '不变', '变为零'], `温度是分子热运动平均动能的宏观表现。`, [moduleName, tag, '分子平均动能'], index),
          () => question(`第 ${n} 组，扩散现象说明分子在（ ）`, '不停地无规则运动', ['静止不动', '只沿直线运动', '只受重力作用'], `扩散是分子热运动的宏观表现。`, [moduleName, tag, '分子热运动'], index),
          () => question(`第 ${n} 组，物体内能与分子动能和分子（ ）有关`, '势能', ['电荷数', '颜色', '形状'], `内能由大量分子的动能和分子势能共同决定。`, [moduleName, tag, '内能'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('thermodynamics')) {
        const variants = [
          () => question(`第 ${n} 组，热力学第一定律体现的是（ ）`, '能量守恒', ['动量守恒', '电荷守恒', '质量数守恒'], `热力学第一定律说明热量、做功和内能变化之间满足能量守恒。`, [moduleName, tag, '热力学第一定律'], index),
          () => question(`第 ${n} 组，外界对气体做功且气体吸热时，气体内能通常（ ）`, '增加', ['减少', '不可能改变', '一定为零'], `吸热和外界做功都会使系统内能增加。`, [moduleName, tag, '内能变化'], index),
          () => question(`第 ${n} 组，气体对外做功时，若不吸热，内能通常（ ）`, '减少', ['增加', '不变', '变为无限大'], `系统对外做功会消耗内能，若没有热量补充，内能减少。`, [moduleName, tag, '做功'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('optics')) {
        const variants = [
          () => question(`第 ${n} 条光线从空气斜射入水中时，折射角通常（ ）入射角`, '小于', ['大于', '等于', '无法比较'], '从光疏介质进入光密介质时，折射光线向法线偏折，折射角小于入射角。', [moduleName, tag, '折射'], index),
          () => question(`用第 ${n} 个平面镜模型观察成像，平面镜成像的特点是（ ）`, '正立、等大、虚像', ['倒立、放大、实像', '正立、缩小、实像', '倒立、等大、虚像'], '平面镜所成像与物体等大、正立，且不能呈现在光屏上，是虚像。', [moduleName, tag, '平面镜成像'], index),
          () => question(`在凸透镜第 ${n} 组实验中，若要成实像，物体通常应位于（ ）`, '焦点以外', ['焦点以内', '透镜中心', '任意位置都不能成像'], '凸透镜成实像要求物距大于焦距，焦点以内通常成正立放大虚像。', [moduleName, tag, '凸透镜'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('photoelectric')) {
        const variants = [
          () => question(`第 ${n} 组，光电效应说明光具有（ ）`, '粒子性', ['只具有机械性', '只具有热效应', '没有能量'], `光电效应中电子吸收单个光子的能量逸出，体现光的粒子性。`, [moduleName, tag, '光电效应'], index),
          () => question(`第 ${n} 组，发生光电效应时，入射光频率需要（ ）极限频率`, '大于或等于', ['小于', '等于零', '无关'], `只有光子能量达到逸出功要求，才可能发生光电效应。`, [moduleName, tag, '极限频率'], index),
          () => question(`第 ${n} 组，光子的能量与频率成（ ）`, '正比', ['反比', '无关', '平方反比'], `光子能量 E=hν，与频率成正比。`, [moduleName, tag, '光子能量'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('atomic')) {
        const variants = [
          () => question(`第 ${n} 个能级示意中，原子从高能级跃迁到低能级时会（ ）`, '放出光子', ['吸收光子', '质量变为零', '电荷消失'], '能级降低时能量减少，差值以光子的形式释放。', [moduleName, tag, '能级跃迁'], index),
          () => question(`分析第 ${n} 组光电效应现象，可说明光具有（ ）`, '粒子性', ['只具有波动性', '机械性', '热传导性'], '光电效应中电子吸收单个光子的能量逸出，体现光的粒子性。', [moduleName, tag, '光电效应'], index),
          () => question(`在第 ${n} 个原子模型中，原子核通常由（ ）组成`, '质子和中子', ['电子和光子', '质子和电子', '中子和分子'], '原子核由质子和中子构成，核外电子分布在核外。', [moduleName, tag, '原子结构'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('modern')) {
        const variants = [
          () => question(`第 ${n} 组，近代物理中，光电效应常用于说明光的（ ）`, '粒子性', ['声学性质', '热传导性', '静电性'], `光电效应是光量子假说的重要证据。`, [moduleName, tag, '光电效应'], index),
          () => question(`第 ${n} 组，原子能级跃迁时，吸收或放出的能量通常表现为（ ）`, '光子', ['水波', '机械功', '热容'], `能级差对应吸收或放出的光子能量。`, [moduleName, tag, '能级跃迁'], index),
          () => question(`第 ${n} 组，核反应释放能量常与（ ）有关`, '质量亏损', ['欧姆定律', '折射角', '温度计刻度'], `核反应中的质量亏损可按 E=mc² 对应能量释放。`, [moduleName, tag, '质量亏损'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('nuclear')) {
        const variants = [
          () => question(`第 ${n} 组衰变数据中，放射性元素半衰期表示（ ）`, '原子核数衰减到一半所需时间', ['质量增加一倍的时间', '温度降到一半的时间', '速度减半的时间'], '半衰期描述放射性原子核数量随时间衰减的规律。', [moduleName, tag, '半衰期'], index),
          () => question(`第 ${n} 个核反应释放巨大能量，常与（ ）有关`, '质量亏损', ['电阻变大', '光路改变', '液体蒸发'], '核反应前后质量差对应能量释放，可由 E=mc² 理解。', [moduleName, tag, '质量亏损'], index),
          () => question(`观察第 ${n} 种核辐射，α 粒子本质上是（ ）`, '氦原子核', ['电子', '中子', '光子'], 'α 粒子由 2 个质子和 2 个中子组成，相当于氦原子核。', [moduleName, tag, '核辐射'], index)
        ];
        return variants[index % variants.length]();
      }
      return question(`${topicTitle}中，判断物理量关系时首先应依据（ ）`, '定义式和适用条件', ['只看数值大小', '忽略单位', '先猜结论'], `物理题要先确认研究对象、单位和公式适用条件，再代入计算。`, [moduleName, tag, '概念判断'], index);
    }

    if (subjectId === 'chemistry') {
      const expandedChemistryQuestion = buildExpandedChemistryQuestion(moduleName, topicTitle, topicSlug, index);
      if (expandedChemistryQuestion) return expandedChemistryQuestion;

      if (topicSlug === 'chemistry-amount-calculation') {
        const variants = [
          () => question(`第 ${n} 组，1 mol 任何微粒所含的微粒数约为（ ）`, '6.02×10^23', ['6.02×10^22', '1.00×10^23', '22.4×10^23'], '1 mol 微粒所含的微粒数为阿伏伽德罗常数，约为 6.02×10^23。', [moduleName, tag, '物质的量'], index),
          () => question(`${n} mol 氢气在标准状况下的体积约为（ ）`, `${22.4 * n} L`, [`${11.2 * n} L`, `${n} L`, `${44.8 * n} L`], '标准状况下 1 mol 气体体积约为 22.4 L，气体体积 V=nVm。', [moduleName, tag, '气体摩尔体积'], index),
          () => question(`第 ${n} 组计算中，物质的量 n 与质量 m、摩尔质量 M 的关系是（ ）`, 'n=m/M', ['n=mM', 'n=M/m', 'n=m+M'], '物质的量等于物质质量除以摩尔质量，注意单位统一。', [moduleName, tag, '摩尔质量'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-classification-state') {
        const variants = [
          () => question(`第 ${n} 组物质分类中，下列属于混合物的是（ ）`, '空气', ['蒸馏水', '氧气', '氯化钠晶体'], '空气由多种气体组成，属于混合物；其余选项可视为纯净物。', [moduleName, tag, '物质分类'], index),
          () => question(`下列第 ${n} 个变化中，属于化学变化的是（ ）`, '铁生锈', ['冰融化', '酒精挥发', '蔗糖溶解'], '铁生锈生成了新物质，属于化学变化。', [moduleName, tag, '化学变化'], index),
          () => question(`第 ${n} 组判断中，酸在水溶液中通常能够电离出（ ）`, 'H+', ['OH-', 'Na+', 'Cl2'], '酸的共同特征是在水溶液中能电离出 H+。', [moduleName, tag, '酸碱盐'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('atomic-structure')) {
        const variants = [
          () => question(`第 ${n} 个原子结构模型中，决定元素种类的是原子中的（ ）`, '质子数', ['中子数', '电子层数', '最外层电子数'], '元素种类由核电荷数即质子数决定，同种元素质子数相同。', [moduleName, tag, '质子数'], index),
          () => question(`分析第 ${n} 个原子模型，原子中质量主要集中在（ ）`, '原子核', ['核外电子', '最外层电子', '化学键'], '质子和中子的质量远大于电子，原子质量主要集中在原子核。', [moduleName, tag, '原子结构'], index),
          () => question(`比较第 ${n} 组元素性质时，同一周期从左到右，元素非金属性一般（ ）`, '逐渐增强', ['逐渐减弱', '保持不变', '先减弱后增强'], '同周期核电荷数增大，原子半径趋小，吸引电子能力增强。', [moduleName, tag, '元素周期律'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-chemical-bonding') {
        const variants = [
          () => question(`第 ${n} 组物质中，NaCl 晶体中主要存在的化学键是（ ）`, '离子键', ['共价键', '金属键', '氢键'], 'Na+ 与 Cl- 之间通过静电作用形成离子键。', [moduleName, tag, '离子键'], index),
          () => question(`第 ${n} 个分子中，H2O 分子内 O-H 之间主要是（ ）`, '共价键', ['离子键', '金属键', '范德华力'], '非金属原子之间通过共用电子对形成共价键。', [moduleName, tag, '共价键'], index),
          () => question(`判断第 ${n} 组分子性质时，分子间作用力主要影响物质的（ ）`, '熔沸点', ['质子数', '核电荷数', '元素种类'], '分子间作用力强弱会影响熔点、沸点和溶解性等物理性质。', [moduleName, tag, '分子间作用力'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-notation-equation') {
        const variants = [
          () => question(`第 ${n} 组化学用语中，硫酸根离子的符号是（ ）`, 'SO4^2-', ['SO3^2-', 'S^2-', 'SO4^-'], '硫酸根离子由 1 个硫原子和 4 个氧原子组成，带 2 个单位负电荷。', [moduleName, tag, '离子符号'], index),
          () => question(`配平第 ${n} 个反应方程式时，最重要的是遵守（ ）`, '原子守恒', ['颜色守恒', '体积一定守恒', '速度守恒'], '化学方程式配平的依据是反应前后各元素原子数相等。', [moduleName, tag, '方程式配平'], index),
          () => question(`第 ${n} 组判断中，化合物中各元素化合价代数和通常为（ ）`, '0', ['+1', '-1', '任意值'], '电中性化合物中各元素化合价代数和为 0。', [moduleName, tag, '化合价'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-concentration-ph') {
        const mol = n;
        const volume = 2;
        const variants = [
          () => question(`${mol} mol 溶质配成 ${volume} L 溶液，物质的量浓度为（ ）`, `${mol / volume} mol/L`, [`${mol + volume} mol/L`, `${mol * volume} mol/L`, `${volume / mol} mol/L`], `物质的量浓度 c=n/V，体积用 L 作单位，代入即可。`, [moduleName, tag, '物质的量浓度'], index),
          () => question(`第 ${n} 组溶液 pH=3，则该溶液呈（ ）`, '酸性', ['中性', '碱性', '无法判断'], '常温下 pH<7 的溶液呈酸性，pH=7 为中性，pH>7 为碱性。', [moduleName, tag, 'pH'], index),
          () => question(`将第 ${n} 组浓溶液加水稀释后，溶质的物质的量通常（ ）`, '不变', ['增大', '减小到零', '无法确定'], '稀释只改变溶剂量和浓度，不改变原有溶质的物质的量。', [moduleName, tag, '稀释'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('redox')) {
        const variants = [
          () => question(`第 ${n} 个反应中，氧化还原反应的本质是（ ）`, '电子转移', ['生成沉淀', '温度升高', '颜色变化'], '氧化还原反应以电子转移和化合价变化为核心。', [moduleName, tag, '电子转移'], index),
          () => question(`分析第 ${n} 个化合价变化，反应中元素化合价升高说明该元素（ ）`, '被氧化', ['被还原', '没有变化', '一定生成沉淀'], '化合价升高对应失电子过程，称为被氧化。', [moduleName, tag, '化合价'], index),
          () => question(`第 ${n} 组氧化还原判断中，氧化剂在反应中通常（ ）`, '得到电子', ['失去电子', '不参与电子转移', '只改变颜色'], '氧化剂使别的物质被氧化，自身得到电子、化合价降低。', [moduleName, tag, '氧化剂'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('periodic')) {
        const period = (n % 3) + 2;
        return question(`观察第 ${period} 周期第 ${n} 组元素，同一周期从左到右，元素非金属性一般（ ）`, '逐渐增强', ['逐渐减弱', '保持不变', '先减弱后增强'], '同周期核电荷数增大，原子半径趋小，吸引电子能力增强。', [moduleName, tag, '周期律'], index);
      }
      if (topicSlug.includes('equilibrium')) {
        const variants = [
          () => question(`第 ${n} 个可逆反应达到平衡时，正反应速率与逆反应速率（ ）`, '相等', ['都为零', '正反应速率更大', '逆反应速率更大'], '化学平衡是动态平衡，正逆反应仍进行，但速率相等。', [moduleName, tag, '动态平衡'], index),
          () => question(`在第 ${n} 组平衡体系中升高温度时，平衡通常向（ ）方向移动`, '吸热反应', ['放热反应', '反应物质量更小', '气体体积更小'], '温度升高相当于给体系加入热量，平衡向吸热方向移动。', [moduleName, tag, '平衡移动'], index),
          () => question(`第 ${n} 组反应中，升高温度通常会使反应速率（ ）`, '加快', ['变为零', '一定减慢', '与温度无关'], '温度升高，活化分子比例增大，反应速率通常加快。', [moduleName, tag, '反应速率'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-ion') {
        const variants = [
          () => question(`第 ${n} 个离子反应案例中，离子反应发生的常见条件不包括（ ）`, '生成单质铁一定发生', ['生成沉淀', '生成气体', '生成水'], '复分解型离子反应常因生成沉淀、气体或弱电解质而进行。', [moduleName, tag, '离子反应条件'], index),
          () => question(`书写第 ${n} 个离子方程式时，强酸强碱和可溶性盐通常写成（ ）`, '离子形式', ['分子形式', '元素符号形式', '电子式'], '强电解质在水溶液中主要以离子存在，离子方程式中应拆写。', [moduleName, tag, '离子方程式'], index),
          () => question(`第 ${n} 组实验中 AgNO3 溶液与 NaCl 溶液混合，主要生成的沉淀是（ ）`, 'AgCl', ['NaNO3', 'AgNO3', 'NaCl'], 'Ag+ 与 Cl- 结合生成难溶的 AgCl 白色沉淀。', [moduleName, tag, '沉淀反应'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-electrolyte-solution') {
        const variants = [
          () => question(`第 ${n} 组物质中，属于强电解质的是（ ）`, 'NaCl', ['蔗糖', '乙醇', '蒸馏水'], 'NaCl 在水溶液中能较完全电离，属于强电解质。', [moduleName, tag, '强电解质'], index),
          () => question(`判断第 ${n} 组溶液导电性时，关键看溶液中是否含有（ ）`, '自由移动的离子', ['大量分子', '不动的原子', '颜色变化'], '溶液导电依赖自由移动离子，离子浓度越高导电性通常越强。', [moduleName, tag, '导电性'], index),
          () => question(`第 ${n} 组弱电解质在水中通常（ ）`, '部分电离', ['完全不电离', '完全电离', '只生成气体'], '弱电解质在水溶液中只有部分分子电离成离子。', [moduleName, tag, '电离平衡'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-ideal-gas') {
        const variants = [
          () => question(`第 ${n} 组气体状态分析中，理想气体状态方程通常写作（ ）`, 'PV=nRT', ['P=nVT', 'V=nRT/P^2', 'PV=RT/n'], '理想气体状态方程为 PV=nRT，用于联系压强、体积、物质的量和温度。', [moduleName, tag, '理想气体状态方程'], index),
          () => question(`在第 ${n} 个密闭容器中，温度升高且体积不变时，气体压强通常（ ）`, '增大', ['减小', '不变', '变为零'], '体积和物质的量不变时，由 PV=nRT 可知压强与温度成正比。', [moduleName, tag, '压强温度关系'], index),
          () => question(`第 ${n} 组气体计算中，使用 PV=nRT 时温度应使用（ ）`, '开尔文温度', ['摄氏温度直接代入', '华氏温度', '任意单位'], '气体状态方程中的温度应使用热力学温度 K。', [moduleName, tag, '温度单位'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-inorganic-properties') {
        const variants = [
          () => question(`第 ${n} 组常见无机物中，碳酸盐遇强酸常会产生（ ）`, 'CO2', ['O2', 'H2', 'NH3'], '碳酸盐与酸反应常生成二氧化碳气体。', [moduleName, tag, '碳酸盐'], index),
          () => question(`判断第 ${n} 组金属活动性时，活泼金属与稀酸反应通常产生（ ）`, 'H2', ['CO2', 'O2', 'Cl2'], '活泼金属与稀酸反应生成盐和氢气。', [moduleName, tag, '金属性质'], index),
          () => question(`第 ${n} 组氧化物中，能与水反应生成碱的常见类型是（ ）`, '活泼金属氧化物', ['酸性氧化物一定不能', '稀有气体', '非电解质'], '部分活泼金属氧化物如 Na2O、CaO 可与水反应生成碱。', [moduleName, tag, '氧化物'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-organic-basic') {
        const variants = [
          () => question(`第 ${n} 个有机物分类中，烃类物质一定含有的元素是（ ）`, '碳和氢', ['氧和氮', '钠和氯', '钙和硫'], '烃是只由碳、氢两种元素组成的有机化合物。', [moduleName, tag, '烃'], index),
          () => question(`判断第 ${n} 个官能团时，羟基通常写作（ ）`, '-OH', ['-COOH', '-CHO', '-NO2'], '羟基的结构简式常写作 -OH，是醇类物质的重要官能团。', [moduleName, tag, '官能团'], index),
          () => question(`第 ${n} 组有机物互为同分异构体，说明它们具有相同的（ ）`, '分子式', ['结构式', '物理性质一定相同', '官能团一定相同'], '同分异构体分子式相同，但结构不同，性质可能不同。', [moduleName, tag, '同分异构'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug.includes('organic')) {
        const variants = [
          () => question(`第 ${n} 个有机反应中，乙烯使溴水褪色，主要发生的反应类型是（ ）`, '加成反应', ['取代反应', '中和反应', '复分解反应'], '乙烯含碳碳双键，双键打开后与溴发生加成。', [moduleName, tag, '加成反应'], index),
          () => question(`第 ${n} 组条件下甲烷与氯气在光照中反应，主要属于（ ）`, '取代反应', ['加成反应', '酯化反应', '中和反应'], '烷烃较典型的反应是取代反应，氯原子取代氢原子。', [moduleName, tag, '取代反应'], index),
          () => question(`第 ${n} 个官能团判断中，乙醇被氧化可生成乙醛，说明乙醇含有（ ）`, '羟基', ['羧基', '碳碳双键', '酯基'], '乙醇的官能团是羟基，羟基参与氧化反应。', [moduleName, tag, '官能团'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-experiment-application') {
        const variants = [
          () => question(`第 ${n} 个化学实验中，闻气体气味的正确方法是（ ）`, '用手轻轻扇闻', ['把鼻子直接凑近', '大口吸入', '点燃后再闻'], '闻气体时应用手轻轻扇动少量气体到鼻前，避免直接吸入。', [moduleName, tag, '实验安全'], index),
          () => question(`检验第 ${n} 组溶液中 Cl- 时，常用的试剂是（ ）`, 'AgNO3 溶液和稀硝酸', ['NaOH 溶液', 'BaCl2 溶液和盐酸', '酚酞'], 'Cl- 与 Ag+ 生成 AgCl 白色沉淀，稀硝酸用于排除干扰。', [moduleName, tag, '离子检验'], index),
          () => question(`第 ${n} 组气体收集实验中，排水法适用于（ ）的气体`, '难溶于水且不与水反应', ['极易溶于水', '与水剧烈反应', '必须有颜色'], '排水法适合收集难溶于水且不与水反应的气体。', [moduleName, tag, '气体收集'], index)
        ];
        return variants[index % variants.length]();
      }
      if (topicSlug === 'chemistry-industrial-process') {
        const variants = [
          () => question(`第 ${n} 个工业流程题中，循环利用未反应原料的主要目的是（ ）`, '提高原料利用率', ['增加废液', '降低产率', '避免分离'], '循环利用可以减少浪费，提高原料利用率和经济性。', [moduleName, tag, '流程分析'], index),
          () => question(`分析第 ${n} 个化工流程时，选择反应条件通常需要兼顾产率、速率和（ ）`, '安全与成本', ['颜色深浅', '容器形状', '答案长度'], '工业生产不仅追求产率，也要考虑反应速率、安全、成本和环保。', [moduleName, tag, '条件选择'], index),
          () => question(`第 ${n} 组流程中，过滤操作主要用于分离（ ）`, '固体和液体', ['两种气体', '两种完全互溶液体', '光和热'], '过滤用于分离不溶性固体与液体，是流程题常见步骤。', [moduleName, tag, '分离提纯'], index)
        ];
        return variants[index % variants.length]();
      }
      return question(`${topicTitle}相关判断中，最应优先关注的是（ ）`, '微粒组成和变化规律', ['只看颜色', '只背名称', '忽略条件'], `化学题需要结合微粒结构、反应条件和守恒关系判断，不能只凭表面现象。`, [moduleName, tag, '概念判断'], index);
    }

    throw new Error(`Unknown subject ${subjectId}`);
  });
}

async function main() {
  for (const subject of SUBJECTS) {
    let sort = 0;
    for (const module of subject.modules) {
      for (const [slug, title, description] of module.topics) {
        sort += 1;
        const questions = buildTopicQuestions(subject.id, module.name, title, slug);
        const displayData = topicDisplayData(slug);
        const topicLocalizations = englishTopicLocalization(slug, module.name, title, description, displayData);
        const topic = await prisma.specialPracticeTopic.upsert({
          where: { slug },
          update: {
            subject: subject.id,
            module: module.name,
            title,
            description,
            ...displayData,
            localizations: topicLocalizations,
            estimatedMinutes: 20,
            questionCount: questions.length,
            sortOrder: sort,
            status: 'published'
          },
          create: {
            subject: subject.id,
            module: module.name,
            slug,
            title,
            description,
            ...displayData,
            localizations: topicLocalizations,
            estimatedMinutes: 20,
            questionCount: questions.length,
            sortOrder: sort,
            status: 'published'
          }
        });
        await prisma.specialPracticeQuestion.deleteMany({ where: { topicId: topic.id } });
        await prisma.specialPracticeQuestion.createMany({
          data: questions.map((item, index) => ({
            topicId: topic.id,
            orderNumber: index + 1,
            difficulty: difficultyForQuestion(subject.id, index),
            questionType: 'single-choice',
            prompt: item.prompt,
            options: item.options,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
            knowledgeTags: item.knowledgeTags,
            localizations: englishQuestionLocalization(item, slug, index),
            status: 'published'
          }))
        });
      }
    }
  }
  if (OBSOLETE_TOPIC_SLUGS.length) {
    await prisma.specialPracticeTopic.updateMany({
      where: { slug: { in: OBSOLETE_TOPIC_SLUGS } },
      data: { status: 'archived' }
    });
  }
  console.log('Seeded CSCA special practice topics and questions.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
