export const TEACHING_VISUALIZER_COMPONENT_KEYS = [
  'visualizer.math.trigonometry',
  'visualizer.math.function-transform',
  'visualizer.math.elementary-functions',
  'visualizer.math.inequality-solutions',
  'visualizer.math.sequence',
  'visualizer.math.probability',
  'visualizer.math.vector-operations',
  'visualizer.math.conic-sections',
  'visualizer.math.coordinate-geometry',
  'visualizer.math.solid-geometry',
  'visualizer.math.calculus',
  'visualizer.math.set-operations',
  'visualizer.physics.newton-second-law',
  'visualizer.physics.kinematics-graphs',
  'visualizer.physics.energy-conservation',
  'visualizer.physics.momentum-collision',
  'visualizer.physics.circular-motion',
  'visualizer.physics.wave-speed',
  'visualizer.physics.thin-lens',
  'visualizer.physics.double-slit',
  'visualizer.physics.electric-field',
  'visualizer.physics.circuit-series-parallel',
  'visualizer.physics.electromagnetic-induction',
  'visualizer.physics.magnetic-force',
  'visualizer.physics.ideal-gas-law',
  'visualizer.physics.thermodynamics-first-law',
  'visualizer.physics.photoelectric-effect',
  'visualizer.chemistry.acid-base-neutralization',
  'visualizer.chemistry.reaction-rate',
  'visualizer.chemistry.redox-cell',
  'visualizer.chemistry.ph-titration',
  'visualizer.chemistry.atomic-periodic',
  'visualizer.chemistry.bonding-structure',
  'visualizer.chemistry.ion-reaction',
  'visualizer.chemistry.organic-hydrocarbon'
] as const;

export const TEACHING_ASSET_COMPONENT_KEYS = [
  'math.function-horizontal-shift',
  'physics.newton-second-law',
  'chemistry.acid-base-neutralization',
  ...TEACHING_VISUALIZER_COMPONENT_KEYS
] as const;

type TeachingAssetQuestionMatchProfile = {
  signals: string[];
  taskFamilies?: string[];
};

const TEACHING_ASSET_QUESTION_MATCH_PROFILES: Record<string, TeachingAssetQuestionMatchProfile> = {
  'math.function-horizontal-shift': { signals: ['函数平移', '图像平移', '向左平移', '向右平移', 'horizontal shift'], taskFamilies: ['horizontal_shift_direction', 'multi_step_graph_transform', 'horizontal_shift_application'] },
  'visualizer.math.function-transform': { signals: ['函数平移', '图像平移', '图像变换', '伸缩', '翻转', 'function transform'], taskFamilies: ['horizontal_shift_direction', 'multi_step_graph_transform', 'horizontal_shift_application'] },
  'visualizer.math.trigonometry': { signals: ['三角函数', '正弦', '余弦', 'sin', 'cos', 'tan', 'unit circle'] },
  'visualizer.math.elementary-functions': { signals: ['一次函数', '二次函数', '指数函数', '对数函数', '幂函数', '定义域', '值域', 'elementary function'] },
  'visualizer.math.inequality-solutions': { signals: ['不等式', '解集', 'inequality'] },
  'visualizer.math.sequence': { signals: ['数列', '等差', '等比', 'sequence'] },
  'visualizer.math.probability': { signals: ['概率', '随机试验', '频率', 'probability'] },
  'visualizer.math.vector-operations': { signals: ['向量', '数量积', 'vector'] },
  'visualizer.math.conic-sections': { signals: ['圆锥曲线', '椭圆', '抛物线', '双曲线', 'conic'] },
  'visualizer.math.coordinate-geometry': { signals: ['解析几何', '坐标几何', '直线斜率', '两点距离', '中点坐标', 'coordinate geometry'] },
  'visualizer.math.solid-geometry': { signals: ['立体几何', '空间几何', '截面', '表面积', '体积', 'solid geometry'] },
  'visualizer.math.calculus': { signals: ['导数', '积分', '切线斜率', 'calculus', 'derivative', 'integral'] },
  'visualizer.math.set-operations': { signals: ['集合', '交集', '并集', '补集', 'set operation'] },
  'physics.newton-second-law': { signals: ['牛顿第二定律', 'f=ma', 'a=f/m', '所受合力', '合力不变', 'newton second law'] },
  'visualizer.physics.newton-second-law': { signals: ['牛顿第二定律', 'f=ma', 'a=f/m', '所受合力', '合力不变', 'newton second law'] },
  'visualizer.physics.kinematics-graphs': { signals: ['运动学图像', '位移图像', '速度图像', '加速度图像', 'x-t', 'v-t', 'a-t', 'kinematics graph'] },
  'visualizer.physics.energy-conservation': { signals: ['机械能', '动能', '势能', '能量守恒', 'energy conservation'] },
  'visualizer.physics.momentum-collision': { signals: ['动量', '碰撞', '冲量', 'momentum', 'collision'] },
  'visualizer.physics.circular-motion': { signals: ['圆周运动', '向心力', '向心加速度', '角速度', '线速度', 'centripetal', 'circular motion'] },
  'visualizer.physics.wave-speed': { signals: ['机械波', '波速', '波长', '频率', 'wave speed', 'wavelength'] },
  'visualizer.physics.thin-lens': { signals: ['透镜', '焦距', '物距', '像距', 'thin lens'] },
  'visualizer.physics.double-slit': { signals: ['双缝', '干涉条纹', 'double slit'] },
  'visualizer.physics.electric-field': { signals: ['电场', '电场线', '电场强度', 'electric field'] },
  'visualizer.physics.circuit-series-parallel': { signals: ['串联电路', '并联电路', '等效电阻', 'series circuit', 'parallel circuit'] },
  'visualizer.physics.electromagnetic-induction': { signals: ['电磁感应', '磁通量', '感应电动势', 'electromagnetic induction'] },
  'visualizer.physics.magnetic-force': { signals: ['洛伦兹力', '磁场中的力', '带电粒子', 'magnetic force', 'lorentz'] },
  'visualizer.physics.ideal-gas-law': { signals: ['理想气体', '气体状态', '压强', 'ideal gas'] },
  'visualizer.physics.thermodynamics-first-law': { signals: ['热力学第一定律', '内能', '吸热', 'thermodynamics first law'] },
  'visualizer.physics.photoelectric-effect': { signals: ['光电效应', '光电子', '截止频率', 'photoelectric'] },
  'chemistry.acid-base-neutralization': { signals: ['酸碱中和', '中和反应', '酸碱滴定', 'acid-base neutralization'] },
  'visualizer.chemistry.acid-base-neutralization': { signals: ['酸碱中和', '中和反应', '酸碱滴定', 'acid-base neutralization'] },
  'visualizer.chemistry.reaction-rate': { signals: ['反应速率', '有效碰撞', '催化剂', 'reaction rate'] },
  'visualizer.chemistry.redox-cell': { signals: ['氧化还原', '原电池', '电子转移', 'redox'] },
  'visualizer.chemistry.ph-titration': { signals: ['ph滴定', '滴定曲线', '当量点', 'titration'] },
  'visualizer.chemistry.atomic-periodic': { signals: ['原子结构', '元素周期律', '电子层', 'periodic'] },
  'visualizer.chemistry.bonding-structure': { signals: ['化学键', '分子结构', '空间构型', 'chemical bond'] },
  'visualizer.chemistry.ion-reaction': { signals: ['离子反应', '离子方程式', 'ion reaction'] },
  'visualizer.chemistry.organic-hydrocarbon': { signals: ['有机烃', '碳链', '同分异构', 'hydrocarbon'] }
};

function normalizedMatchText(value: string) {
  return value.toLowerCase().replace(/[\s_·，。；：、（）(){}\[\]$\\]/g, '');
}

export function teachingAssetMatchesQuestion(componentKey: string, question: {
  prompt: string;
  explanation?: string | null;
  knowledgeTags?: unknown;
  taskFamily?: string | null;
}) {
  const profile = TEACHING_ASSET_QUESTION_MATCH_PROFILES[componentKey];
  if (!profile) return false;
  const taskFamily = String(question.taskFamily ?? '').trim();
  if (taskFamily && profile.taskFamilies?.includes(taskFamily)) return true;
  const tags = Array.isArray(question.knowledgeTags) ? question.knowledgeTags.map(String) : [];
  const evidence = normalizedMatchText([question.prompt, question.explanation ?? '', ...tags].join(' '));
  return profile.signals.some((signal) => evidence.includes(normalizedMatchText(signal)));
}

const INTERACTIVE_SIMULATION_CAPABILITY = { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false } as const;

export const TEACHING_ASSET_CAPABILITIES: Record<string, typeof INTERACTIVE_SIMULATION_CAPABILITY> = {
  'math.function-horizontal-shift@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'physics.newton-second-law@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'chemistry.acid-base-neutralization@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  ...Object.fromEntries(TEACHING_VISUALIZER_COMPONENT_KEYS.map((key) => [`${key}@1`, INTERACTIVE_SIMULATION_CAPABILITY]))
};

export function getTeachingAssetCapability(componentKey: string, componentVersion: string) {
  return TEACHING_ASSET_CAPABILITIES[componentKey + '@' + componentVersion] ?? null;
}
