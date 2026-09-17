const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const LETTERS = ['A', 'B', 'C', 'D'];

function optionObjects(texts, correctIndex) {
  const [correctText, ...distractors] = texts;
  return LETTERS.map((id, index) => ({
    id,
    text: index === correctIndex ? correctText : distractors.shift(),
    isCorrect: index === correctIndex
  }));
}

function q(prompt, options, explanation, tags) {
  const correct = options.find((option) => option.isCorrect);
  if (!correct) throw new Error(`Question is missing a correct option: ${prompt}`);
  return {
    prompt,
    correctAnswer: correct.id,
    options: options.map(({ id, text }) => ({ id, text })),
    explanation,
    tags
  };
}

function mathQuestions() {
  const items = [];
  [
    [3, 8], [5, 12], [-2, 7], [4, 1], [-6, -1], [9, 20], [0, 5], [7, 15]
  ].forEach(([a, b], index) => {
    const answer = b - a;
    items.push(q(
      `不等式 x + ${a} > ${b} 的解集为（ ）`,
      optionObjects([`x > ${answer}`, `x < ${answer}`, `x ≥ ${answer}`, `x ≤ ${answer}`], index % 4),
      `两边同时减去 ${a}，得到 x > ${answer}。`,
      ['集合与不等式']
    ));
  });
  [
    [2, 3], [-1, 5], [4, -2], [3, 0], [-2, -4], [5, 1], [1, -6], [6, 7]
  ].forEach(([m, b], index) => {
    items.push(q(
      `一次函数 y=${m}x${b >= 0 ? `+${b}` : b} 与 y 轴的交点坐标是（ ）`,
      optionObjects([`(0, ${b})`, `(${b}, 0)`, `(1, ${m + b})`, `(0, ${m})`], (index + 1) % 4),
      `与 y 轴相交时 x=0，代入得 y=${b}。`,
      ['函数']
    ));
  });
  [
    [2, 3, 6], [5, 4, 5], [1, 2, 10], [7, -1, 8], [3, 5, 4], [-2, 3, 7], [10, -2, 6], [4, 6, 3]
  ].forEach(([first, diff, n], index) => {
    const answer = first + (n - 1) * diff;
    items.push(q(
      `等差数列首项为 ${first}，公差为 ${diff}，第 ${n} 项是（ ）`,
      optionObjects([`${answer}`, `${answer + diff}`, `${first + n * diff}`, `${answer - diff}`], (index + 2) % 4),
      `等差数列通项为 a_n=a_1+(n-1)d，因此第 ${n} 项为 ${answer}。`,
      ['函数', '几何与代数']
    ));
  });
  [
    [6, 8], [5, 12], [9, 12], [8, 15], [7, 24], [10, 24], [12, 16], [20, 21]
  ].forEach(([a, b], index) => {
    const c = Math.sqrt(a * a + b * b);
    items.push(q(
      `直角三角形两条直角边分别为 ${a} 和 ${b}，斜边长为（ ）`,
      optionObjects([`${c}`, `${a + b}`, `${Math.abs(a - b)}`, `${a * b}`], (index + 3) % 4),
      `由勾股定理 c²=${a}²+${b}²，得 c=${c}。`,
      ['几何与代数']
    ));
  });
  [
    [2, 5], [3, 8], [4, 9], [5, 12], [1, 6], [7, 10], [6, 11], [8, 15]
  ].forEach(([favorable, total], index) => {
    items.push(q(
      `袋中有 ${total} 个大小相同的小球，其中 ${favorable} 个为红球，随机取 1 个，取到红球的概率是（ ）`,
      optionObjects([`${favorable}/${total}`, `${total}/${favorable}`, `${total - favorable}/${total}`, `${favorable}/${total + favorable}`], index % 4),
      `等可能取球时，概率=有利结果数/总结果数=${favorable}/${total}。`,
      ['概率与统计']
    ));
  });
  [4, 5, 6, 7, 8, 9, 10, 11].forEach((root, index) => {
    items.push(q(
      `方程 x²=${root * root} 的实数解为（ ）`,
      optionObjects([`±${root}`, `${root}`, `-${root}`, `${root * root}`], (index + 1) % 4),
      `平方等于 ${root * root} 的实数有 ${root} 和 -${root}。`,
      ['几何与代数']
    ));
  });
  return items;
}

function physicsQuestions() {
  const items = [];
  [
    [2, 3], [4, 5], [6, 2], [8, 3], [5, 4], [10, 2], [3, 7], [9, 4]
  ].forEach(([m, a], index) => {
    const force = m * a;
    items.push(q(
      `质量为 ${m} kg 的物体获得 ${a} m/s² 的加速度，所受合力为（ ）`,
      optionObjects([`${force} N`, `${m + a} N`, `${Math.abs(m - a)} N`, `${force * 2} N`], index % 4),
      `由牛顿第二定律 F=ma，合力为 ${m}×${a}=${force} N。`,
      ['力学']
    ));
  });
  [
    [120, 6], [80, 4], [150, 5], [210, 7], [60, 3], [240, 8], [90, 5], [300, 10]
  ].forEach(([s, t], index) => {
    const v = s / t;
    items.push(q(
      `物体做匀速直线运动，${t} s 内通过 ${s} m，速度为（ ）`,
      optionObjects([`${v} m/s`, `${s * t} m/s`, `${t / s} m/s`, `${s + t} m/s`], (index + 1) % 4),
      `匀速运动速度 v=s/t=${s}/${t}=${v} m/s。`,
      ['力学']
    ));
  });
  [
    [6, 3], [12, 4], [15, 5], [24, 6], [9, 3], [20, 4], [18, 6], [30, 5]
  ].forEach(([u, r], index) => {
    const current = u / r;
    items.push(q(
      `电阻为 ${r} Ω 的导体两端电压为 ${u} V，通过它的电流为（ ）`,
      optionObjects([`${current} A`, `${u * r} A`, `${r / u} A`, `${u + r} A`], (index + 2) % 4),
      `根据欧姆定律 I=U/R=${u}/${r}=${current} A。`,
      ['电磁学']
    ));
  });
  [
    [100, 5], [240, 8], [360, 12], [90, 3], [450, 15], [600, 20], [72, 6], [180, 9]
  ].forEach(([work, time], index) => {
    const power = work / time;
    items.push(q(
      `某机械在 ${time} s 内做功 ${work} J，平均功率为（ ）`,
      optionObjects([`${power} W`, `${work * time} W`, `${work + time} W`, `${time / work} W`], (index + 3) % 4),
      `功率 P=W/t=${work}/${time}=${power} W。`,
      ['力学']
    ));
  });
  [
    [2, 10], [3, 8], [5, 6], [4, 12], [1, 25], [6, 5], [8, 4], [7, 9]
  ].forEach(([mass, deltaT], index) => {
    const heat = mass * deltaT;
    items.push(q(
      `某物体比热容取 1 J/(g·℃)，质量 ${mass} g，升高 ${deltaT} ℃ 吸收热量为（ ）`,
      optionObjects([`${heat} J`, `${mass + deltaT} J`, `${deltaT - mass} J`, `${heat * 10} J`], index % 4),
      `热量 Q=cmΔT=1×${mass}×${deltaT}=${heat} J。`,
      ['热学']
    ));
  });
  [
    ['平面镜成像', '正立、等大的虚像', '倒立、缩小的实像', '正立、放大的实像', '倒立、等大的虚像', '光学'],
    ['凸透镜对平行光', '会聚作用', '发散作用', '吸收作用', '只改变颜色', '光学'],
    ['声音在真空中', '不能传播', '传播最快', '只沿曲线传播', '频率变为 0', '波动'],
    ['频率越高的声音', '音调越高', '响度越大', '传播速度越大', '一定不能听见', '波动'],
    ['光从空气斜射入水中通常会', '发生折射', '停止传播', '只发生漫反射', '频率变为 0', '光学'],
    ['电磁波在真空中传播速度约为', '3.0×10^8 m/s', '340 m/s', '9.8 m/s²', '1.5×10^3 m/s', '近代物理'],
    ['原子核带', '正电', '负电', '不带电', '可变为光子', '近代物理'],
    ['物体吸热熔化时温度可能保持不变，说明热量用于', '改变物态', '减小质量', '消灭分子', '改变重力', '热学']
  ].forEach(([stem, correct, b, c, d, tag], index) => {
    items.push(q(
      `${stem} 的正确说法是（ ）`,
      optionObjects([correct, b, c, d], (index + 1) % 4),
      `${stem} 对应的基础结论是：${correct}。`,
      [tag]
    ));
  });
  return items;
}

function chemistryQuestions() {
  const items = [];
  [
    ['水', 'H2O', 'CO2', 'O2', 'NaCl', '物质结构'],
    ['二氧化碳', 'CO2', 'CO', 'CaCO3', 'O3', '物质结构'],
    ['氯化钠', 'NaCl', 'NaOH', 'HCl', 'Na2CO3', '物质结构'],
    ['甲烷', 'CH4', 'C2H6', 'C2H4', 'CH3OH', '有机化学'],
    ['氢氧化钠', 'NaOH', 'NaCl', 'Na2O', 'HNO3', '物质结构'],
    ['碳酸钙', 'CaCO3', 'CaCl2', 'CO2', 'CaO', '物质结构'],
    ['硫酸', 'H2SO4', 'HCl', 'HNO3', 'Na2SO4', '物质结构'],
    ['乙醇', 'C2H5OH', 'CH4', 'C2H4', 'CH3COOH', '有机化学']
  ].forEach(([name, correct, b, c, d, tag], index) => {
    items.push(q(
      `${name} 的化学式是（ ）`,
      optionObjects([correct, b, c, d], index % 4),
      `${name} 的常用化学式为 ${correct}。`,
      [tag]
    ));
  });
  [
    [2, 8], [5, 20], [3, 15], [10, 50], [4, 25], [6, 30], [8, 40], [12, 60]
  ].forEach(([solute, solution], index) => {
    const percent = (solute / solution) * 100;
    items.push(q(
      `${solution} g 溶液中含溶质 ${solute} g，该溶液的质量分数为（ ）`,
      optionObjects([`${percent}%`, `${solute + solution}%`, `${solution / solute}%`, `${solution - solute}%`], (index + 1) % 4),
      `质量分数=溶质质量/溶液质量×100%=${solute}/${solution}×100%=${percent}%。`,
      ['溶液']
    ));
  });
  [
    ['pH=2 的溶液', '酸性', '中性', '碱性', '无法判断', '溶液'],
    ['pH=7 的纯水', '中性', '酸性', '碱性', '强氧化性', '溶液'],
    ['pH=11 的溶液', '碱性', '酸性', '中性', '不导电', '溶液'],
    ['酸能使紫色石蕊试液', '变红', '变蓝', '变绿', '无变化', '溶液'],
    ['碱能使酚酞试液通常', '变红', '变蓝', '变黑', '生成沉淀', '溶液'],
    ['盐酸与氢氧化钠反应属于', '中和反应', '分解反应', '置换反应', '聚合反应', '反应原理'],
    ['稀释浓硫酸时应', '将浓硫酸沿器壁慢慢倒入水中并搅拌', '把水倒入浓硫酸', '直接用手搅拌', '密闭加热', '反应原理'],
    ['酸碱中和反应的主要生成物通常有', '盐和水', '单质和氧气', '酸和金属', '碱和氢气', '反应原理']
  ].forEach(([stem, correct, b, c, d, tag], index) => {
    items.push(q(
      `${stem}，正确的是（ ）`,
      optionObjects([correct, b, c, d], (index + 2) % 4),
      `${stem} 的基础判断为：${correct}。`,
      [tag]
    ));
  });
  [
    ['2H2 + O2 → 2H2O', '反应前后 H 原子和 O 原子数相等', '氧原子消失', '氢原子变成氧原子', '反应不守恒'],
    ['CaCO3 → CaO + CO2', '属于分解反应', '属于化合反应', '生成单质钙', '没有新物质生成'],
    ['Fe + CuSO4 → FeSO4 + Cu', '属于置换反应', '属于中和反应', '属于分解反应', '没有元素化合价变化'],
    ['C + O2 → CO2', '属于化合反应', '属于复分解反应', '生成盐和水', '反应物只有化合物'],
    ['质量守恒定律', '适用于化学反应', '表示体积一定守恒', '表示分子种类不变', '只适用于气体'],
    ['化学反应前后', '原子种类和数目守恒', '分子种类一定不变', '颜色一定不变', '状态一定不变'],
    ['燃烧通常需要', '可燃物、氧气和达到着火点', '只需要水', '只需要二氧化碳', '完全隔绝空气'],
    ['铁生锈主要与', '氧气和水有关', '氮气和氦气有关', '真空有关', '强光照射有关']
  ].forEach(([stem, correct, b, c, d], index) => {
    items.push(q(
      `关于 ${stem} 的说法正确的是（ ）`,
      optionObjects([correct, b, c, d], (index + 3) % 4),
      `该题考查反应原理，正确结论是：${correct}。`,
      ['反应原理']
    ));
  });
  [
    ['催化剂', '能改变化学反应速率', '一定增加生成物质量', '反应后一定消失', '只适用于物理变化'],
    ['升高温度通常', '能加快许多反应速率', '一定停止反应', '使质量不守恒', '使原子消失'],
    ['增大反应物浓度通常', '能提高有效碰撞机会', '一定降低反应速率', '不影响任何反应', '使溶剂消失'],
    ['粉末状固体比块状固体反应更快，常因为', '接触面积更大', '质量一定更小', '颜色更浅', '密度为 0'],
    ['可逆反应达到平衡时', '正逆反应速率相等', '反应完全停止', '反应物全部消失', '生成物全部消失'],
    ['化学平衡移动与', '浓度、温度、压强等条件有关', '元素名称无关', '颜色必然无关', '容器形状唯一有关'],
    ['有机物通常含有', '碳元素', '钠元素', '氦元素', '氖元素'],
    ['乙酸中含有的典型官能团是', '羧基', '羟基', '醛基', '氨基']
  ].forEach(([stem, correct, b, c, d], index) => {
    items.push(q(
      `${stem} 的正确说法是（ ）`,
      optionObjects([correct, b, c, d], index % 4),
      `${stem} 对应的基础化学结论是：${correct}。`,
      index < 6 ? ['反应原理'] : ['有机化学']
    ));
  });
  [
    ['乙烯能使溴水褪色，主要因为分子中含有', '碳碳双键', '钠离子', '氯离子', '稀有气体原子', '有机化学'],
    ['葡萄糖属于', '有机物', '单质', '盐', '稀有气体', '有机化学'],
    ['天然气主要成分通常是', '甲烷', '乙酸', '乙醇', '碳酸钙', '有机化学'],
    ['蛋白质中通常含有', '碳、氢、氧、氮等元素', '只含铁元素', '只含钠元素', '只含氦元素', '有机化学'],
    ['离子化合物 NaCl 熔融时能导电，主要因为', '存在可自由移动的离子', '分子完全静止', '没有带电粒子', '颜色变深', '物质结构'],
    ['同位素原子一定具有相同的', '质子数', '中子数', '质量数', '相对原子质量', '物质结构'],
    ['原子失去电子后通常形成', '阳离子', '阴离子', '中子', '分子晶体', '物质结构'],
    ['溶液具有均一性，表示取任意一部分时', '组成基本相同', '一定有沉淀', '颜色必然不同', '溶质一定消失', '溶液']
  ].forEach(([stem, correct, b, c, d, tag], index) => {
    items.push(q(
      `${stem}（ ）`,
      optionObjects([correct, b, c, d], (index + 1) % 4),
      `该题考查${tag}基础概念，正确答案是：${correct}。`,
      [tag]
    ));
  });
  return items;
}

const SUBJECTS = [
  {
    subject: 'math',
    title: '数学',
    tags: ['集合与不等式', '函数', '几何与代数', '概率与统计'],
    questions: mathQuestions()
  },
  {
    subject: 'physics',
    title: '物理',
    tags: ['力学', '电磁学', '热学', '光学', '近代物理'],
    questions: physicsQuestions()
  },
  {
    subject: 'chemistry',
    title: '化学',
    tags: ['物质结构', '反应原理', '溶液', '有机化学'],
    questions: chemistryQuestions()
  }
];

function validateSubject(subject) {
  if (subject.questions.length !== 48) {
    throw new Error(`${subject.title} must have 48 questions, got ${subject.questions.length}.`);
  }
  subject.questions.forEach((question, index) => {
    if (!question.prompt || !question.explanation) throw new Error(`${subject.title} question ${index + 1} is incomplete.`);
    if (!LETTERS.includes(question.correctAnswer)) throw new Error(`${subject.title} question ${index + 1} has invalid answer.`);
    if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`${subject.title} question ${index + 1} must have 4 options.`);
    if (!question.options.some((option) => option.id === question.correctAnswer)) throw new Error(`${subject.title} question ${index + 1} answer is not in options.`);
    if (!Array.isArray(question.tags) || question.tags.length === 0) throw new Error(`${subject.title} question ${index + 1} must have tags.`);
  });
}

async function seedSubject(subject) {
  validateSubject(subject);
  const paperTotals = { math: 11, physics: 6, chemistry: 5 };
  const total = paperTotals[subject.subject] ?? 3;
  const papers = Array.from({ length: total }, (_, index) => {
    const paperIndex = index + 1;
    const tone = paperIndex === 1 ? '原创仿真' : paperIndex <= 3 ? '完整' : '强化';
    return {
      index: paperIndex,
      isFree: true,
      isLocked: false,
      questionCount: 48,
      priceLabel: '免费',
      description: `${subject.title}${tone}模拟卷，48 题 / 60 分钟，可直接免费练习。`
    };
  });

  for (const paper of papers) {
    const slug = `${subject.subject}-mock-${paper.index}`;
    const saved = await prisma.mockExamPaper.upsert({
      where: { slug },
      update: {
        subject: subject.subject,
        title: `${subject.title}模拟卷 ${paper.index}`,
        description: paper.description,
        language: 'zh',
        questionCount: paper.questionCount,
        durationMinutes: 60,
        priceLabel: paper.priceLabel,
        isFree: paper.isFree,
        isLocked: paper.isLocked,
        sortOrder: paper.index,
        status: 'published'
      },
      create: {
        subject: subject.subject,
        slug,
        title: `${subject.title}模拟卷 ${paper.index}`,
        description: paper.description,
        language: 'zh',
        questionCount: paper.questionCount,
        durationMinutes: 60,
        priceLabel: paper.priceLabel,
        isFree: paper.isFree,
        isLocked: paper.isLocked,
        sortOrder: paper.index,
        status: 'published'
      }
    });

    await prisma.mockExamQuestion.deleteMany({ where: { paperId: saved.id } });
    await prisma.mockExamQuestion.createMany({
      data: subject.questions.map((question, index) => ({
        paperId: saved.id,
        orderNumber: index + 1,
        questionType: 'single-choice',
        prompt: question.prompt,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        knowledgeTags: question.tags,
        status: 'published'
      }))
    });
  }
}

async function main() {
  for (const subject of SUBJECTS) {
    await seedSubject(subject);
  }
}

main()
  .then(() => {
    console.log('Seeded CSCA mock exam papers with all published papers free.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
