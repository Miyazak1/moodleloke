const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const catalog = [
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.trigonometry', '三角函数与单位圆', '拖动角度，同时观察单位圆坐标与三角函数曲线。', '角度变化与 sin、cos、tan 图像之间的对应关系'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.function-transform', '函数图像变换', '调节参数，比较平移、伸缩和翻转前后的函数图像。', '参数变化如何改变函数图像的位置和形状'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.elementary-functions', '基本初等函数', '比较一次、二次、指数、对数和幂函数的典型图像。', '不同函数族的定义域、值域与增长特征'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.inequality-solutions', '不等式解集', '改变系数和不等号，观察数轴与函数图像上的解集。', '不等式符号、零点与解集区间之间的关系'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.sequence', '数列变化规律', '切换等差与等比数列，观察项值和公差、公比的影响。', '递推参数如何影响数列的增长模式'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.probability', '概率收敛模拟', '重复随机试验，观察频率如何逐渐接近理论概率。', '试验次数增加时频率与概率的关系'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.calculus', '导数与积分', '移动观察点和积分区间，连接斜率、切线与面积。', '导数的局部变化率和积分的累积量含义'],
  ['DEMO-MATH-FUNCTIONS', 'visualizer.math.set-operations', '集合运算', '调整集合并切换交、并、差和补集，高亮对应区域。', '集合运算符与维恩图区域的对应关系'],
  ['DEMO-MATH-GEOMETRY', 'visualizer.math.vector-operations', '向量运算', '改变向量方向和长度，观察加减法与数量积。', '向量分量、合向量和夹角之间的关系'],
  ['DEMO-MATH-GEOMETRY', 'visualizer.math.conic-sections', '圆锥曲线', '切换椭圆、抛物线与双曲线，比较参数和几何特征。', '方程参数与焦点、顶点和渐近线的关系'],
  ['DEMO-MATH-GEOMETRY', 'visualizer.math.coordinate-geometry', '解析几何', '拖动关键点，观察直线、距离、斜率和坐标变化。', '几何位置如何转化为坐标与代数关系'],
  ['DEMO-MATH-GEOMETRY', 'visualizer.math.solid-geometry', '立体几何', '旋转并比较常见立体，观察截面、表面积与体积。', '空间形状、尺寸与截面之间的关系'],
  ['DEMO-PHYSICS-MECHANICS', 'visualizer.physics.kinematics-graphs', '运动学图像', '调节运动参数，联动观察位移、速度和加速度图像。', 'x-t、v-t 与 a-t 图像之间的对应关系'],
  ['DEMO-PHYSICS-MECHANICS', 'visualizer.physics.newton-second-law', '牛顿第二定律', '改变合力与质量，实时观察加速度的变化。', '合力、质量和加速度之间的定量关系'],
  ['DEMO-PHYSICS-MECHANICS', 'visualizer.physics.energy-conservation', '机械能守恒', '调节初始条件，观察动能、势能与机械能的转换。', '动能和势能转化时总机械能的变化'],
  ['DEMO-PHYSICS-MECHANICS', 'visualizer.physics.momentum-collision', '动量与碰撞', '改变质量、速度和碰撞类型，比较碰撞前后动量。', '系统总动量在不同碰撞中的守恒关系'],
  ['DEMO-PHYSICS-MECHANICS', 'visualizer.physics.circular-motion', '圆周运动', '改变速度、半径和质量，观察向心加速度与向心力。', '线速度、半径和向心量之间的关系'],
  ['DEMO-CHEM-REDOX', 'visualizer.chemistry.redox-cell', '原电池与氧化还原', '选择电极和电解质，观察电子、离子迁移及电势变化。', '氧化还原反应与电子流动、原电池电势的关系'],
  [null, 'visualizer.physics.wave-speed', '波速与波长', '调节频率和波长，观察波形与传播速度。', '波速、频率和波长的关系'],
  [null, 'visualizer.physics.thin-lens', '薄透镜成像', '移动物体和焦点，观察像的位置、大小与虚实。', '物距、像距和焦距的关系'],
  [null, 'visualizer.physics.double-slit', '双缝干涉', '调节波长、缝距和屏距，观察干涉条纹。', '干涉条纹间距与实验参数的关系'],
  [null, 'visualizer.physics.electric-field', '电场与电场线', '改变电荷的位置和电性，观察电场线分布。', '电荷分布与电场方向、强弱的关系'],
  [null, 'visualizer.physics.circuit-series-parallel', '串并联电路', '组合电阻并调节电源，比较支路电流和电压。', '串并联电路中电压、电流和等效电阻'],
  [null, 'visualizer.physics.electromagnetic-induction', '电磁感应', '改变磁通量及变化速率，观察感应电流。', '磁通量变化与感应电动势的关系'],
  [null, 'visualizer.physics.magnetic-force', '磁场中的力', '调节速度、磁场和电荷，观察磁力方向和大小。', '运动电荷、磁场与磁力的关系'],
  [null, 'visualizer.physics.ideal-gas-law', '理想气体状态', '改变温度、体积和物质的量，观察压强。', '压强、体积、温度和物质的量的关系'],
  [null, 'visualizer.physics.thermodynamics-first-law', '热力学第一定律', '调节吸热和做功，观察系统内能的变化。', '热量、做功和内能变化的关系'],
  [null, 'visualizer.physics.photoelectric-effect', '光电效应', '改变光频率和强度，观察光电子逸出。', '截止频率、光强与光电子能量的关系'],
  [null, 'visualizer.chemistry.acid-base-neutralization', '酸碱中和', '混合酸碱溶液，观察组分、pH 和中和进程。', '酸碱物质的量与 pH 变化的关系'],
  [null, 'visualizer.chemistry.reaction-rate', '化学反应速率', '改变浓度、温度和催化剂，比较反应速率。', '反应条件对有效碰撞和速率的影响'],
  [null, 'visualizer.chemistry.ph-titration', 'pH 滴定曲线', '逐步加入滴定剂，观察 pH 曲线和当量点。', '滴定体积、pH 与当量点的关系'],
  [null, 'visualizer.chemistry.atomic-periodic', '原子结构与周期律', '比较元素的电子层和周期性变化。', '原子结构与元素周期性质的关系'],
  [null, 'visualizer.chemistry.bonding-structure', '化学键与分子结构', '切换键型和分子，观察成键与空间构型。', '价电子、化学键和分子几何的关系'],
  [null, 'visualizer.chemistry.ion-reaction', '离子反应', '选择溶液并混合，观察离子变化和反应条件。', '溶液中实际参与反应的离子与净离子方程式'],
  [null, 'visualizer.chemistry.organic-hydrocarbon', '有机烃结构', '组合碳链和键型，比较烃的结构与性质。', '碳骨架、饱和度与同分异构的关系']
];

function payload(componentKey, title, summary, focus) {
  return {
    schemaVersion: '1',
    title,
    summary,
    instructions: ['先保持默认参数，辨认图中的物理量或数学对象。', '每次只改变一个参数，比较变化前后的结果。', '用观察到的规律回答即时检查。'],
    component: { key: componentKey, version: '1', props: {} },
    activePrompt: {
      id: `${componentKey.replaceAll('.', '-')}-check-v1`,
      prompt: `这个模拟最适合帮助你理解什么？`,
      options: [
        { id: 'relationship', label: focus },
        { id: 'memorize', label: '只记住一个静态结论，不比较参数变化' }
      ],
      correctAnswer: 'relationship',
      correctFeedback: '正确。交互模拟的价值在于建立变量变化与结果之间的联系。',
      incorrectFeedback: '再改变一个参数，比较图像或数值前后的变化。'
    },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
}

async function main() {
  const topicCodes = [...new Set(catalog.map(([topicCode]) => topicCode).filter(Boolean))];
  const topics = await prisma.cscaExamTopic.findMany({ where: { code: { in: topicCodes }, status: 'published' } });
  const topicByCode = new Map(topics.map((topic) => [topic.code, topic]));
  const missing = topicCodes.filter((code) => !topicByCode.has(code));
  if (missing.length) throw new Error(`Published topics are missing: ${missing.join(', ')}`);

  for (const [topicCode, componentKey, title, summary, focus] of catalog) {
    const topic = topicCode ? topicByCode.get(topicCode) : null;
    const subject = componentKey.split('.')[1];
    const status = topic ? 'published' : 'draft';
    const asset = await prisma.teachingAsset.upsert({
      where: { stableKey: componentKey },
      create: { stableKey: componentKey, type: 'micro_lesson', subjectCode: subject, status },
      update: { type: 'micro_lesson', subjectCode: subject, status }
    });
    const content = payload(componentKey, title, summary, focus);
    await prisma.teachingAssetVersion.upsert({
      where: { assetId_version: { assetId: asset.id, version: 1 } },
      create: {
        assetId: asset.id, version: 1, status, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 5,
        renderer: 'interactive_component', componentKey, componentVersion: '1', payloadSchemaVersion: 'existing-visualizer-v1', payload: content,
        fallbackPayload: { title, body: summary }, sourceRefs: [{ type: 'visualizer_catalog', id: componentKey, version: '1' }],
        reviewState: topic ? 'approved' : 'draft', reviewedAt: topic ? new Date() : null, publishedAt: topic ? new Date() : null
      },
      update: {
        status, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 5,
        renderer: 'interactive_component', componentKey, componentVersion: '1', payloadSchemaVersion: 'existing-visualizer-v1', payload: content,
        fallbackPayload: { title, body: summary }, sourceRefs: [{ type: 'visualizer_catalog', id: componentKey, version: '1' }],
        reviewState: topic ? 'approved' : 'draft', reviewedAt: topic ? new Date() : null, publishedAt: topic ? new Date() : null, retiredAt: null
      }
    });
    if (topic) {
      await prisma.teachingAssetTopic.upsert({
        where: { assetId_topicId_relationship: { assetId: asset.id, topicId: topic.id, relationship: 'primary' } },
        create: { assetId: asset.id, topicId: topic.id, relationship: 'primary', sortOrder: 0 },
        update: { sortOrder: 0 }
      });
    }
  }

  const published = catalog.filter(([topicCode]) => topicCode).length;
  console.log(`Registered ${catalog.length} teaching assets; published ${published} across ${topics.length} topics (${catalog.length - published} awaiting topic bindings).`);
}

main().finally(() => prisma.$disconnect());
