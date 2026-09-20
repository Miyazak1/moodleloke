const { randomBytes, scrypt: scryptCallback, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient();
const rootDir = path.resolve(__dirname, '..');
const credentialPath = path.join(rootDir, '.local', 'agent-demo-credentials.json');
const fixtureDir = path.join(rootDir, '.local', 'agent-demo-fixtures');
const handwrittenFixturePath = path.join(fixtureDir, 'handwritten-function-answer.png');
const pdfFixturePath = path.join(fixtureDir, 'function-answer.pdf');
const uploadDir = path.join(rootDir, 'backend', 'uploads', 'past-papers');
const email = 'agent-demo@moodlelike.local';
const marker = 'LOCAL_DEMO_ONLY';
const demoQuestionPrompt = '已知函数 f(x)=2x+3，则 f(4) 的值是（ ）';

function assertLocalDatabase() {
  if (!process.argv.includes('--apply')) throw new Error('Refusing to write without --apply.');
  if (process.env.NODE_ENV === 'production' || process.env.MOODLELIKE_ENV === 'production' || process.env.CSC_ENV === 'production') throw new Error('Demo seed is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error(`Demo seed only accepts a local database host, received ${databaseUrl.hostname || 'unset'}.`);
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString('hex')}`;
}

function credentials() {
  if (fs.existsSync(credentialPath)) return JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
  const value = { email, password: `AgentDemo-${randomBytes(18).toString('base64url')}` };
  fs.writeFileSync(credentialPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return value;
}

async function ensureTopic(subject, fallbackCode, fallbackTitle, order = 0) {
  const activeImport = await prisma.cscaSyllabusImport.findFirst({
    where: { subject, status: 'applied' },
    orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }]
  });
  const existing = await prisma.cscaExamTopic.findFirst({
    where: { subject, status: 'published', ...(activeImport ? { syllabusVersion: activeImport.syllabusVersion } : {}) },
    orderBy: [{ weight: 'desc' }, { id: 'asc' }],
    skip: order
  });
  if (existing) return existing;
  return prisma.cscaExamTopic.upsert({
    where: { code: fallbackCode },
    update: { status: 'published', title: fallbackTitle, sourceLabel: marker },
    create: { subject, code: fallbackCode, title: fallbackTitle, sourceLabel: marker, status: 'published', weight: 1 }
  });
}

async function ensurePastPaper() {
  const slug = 'agent-demo-2026-chemistry-past-paper';
  const paper = await prisma.pastPaper.upsert({
    where: { slug },
    update: {
      title: 'CSCA 2026 化学真题（本地演示）', category: 'past-paper', subject: 'chemistry', examYear: 2026,
      examMonth: '3月', sessionLabel: '本地演示', language: 'zh', questionCount: 48, pageCount: 18,
      description: marker, hasAnswers: true, hasSolutions: true, isFree: true, isPublished: true, sortOrder: -999, deletedAt: null
    },
    create: {
      slug, title: 'CSCA 2026 化学真题（本地演示）', category: 'past-paper', subject: 'chemistry', examYear: 2026,
      examMonth: '3月', sessionLabel: '本地演示', language: 'zh', questionCount: 48, pageCount: 18,
      description: marker, hasAnswers: true, hasSolutions: true, isFree: true, isPublished: true, isFeatured: false, sortOrder: -999
    }
  });
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${slug}.pdf`;
  const bytes = buildDemoPdf();
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, bytes);
  const existing = await prisma.pastPaperFile.findFirst({ where: { pastPaperId: paper.id, label: marker } });
  const data = {
    pastPaperId: paper.id, kind: 'paper', label: marker, fileUrl: `/uploads/past-papers/${filename}`,
    originalFilename: filename, mimeType: 'application/pdf', fileSizeBytes: bytes.length,
    checksum: createHash('sha256').update(bytes).digest('hex')
  };
  if (existing) await prisma.pastPaperFile.update({ where: { id: existing.id }, data });
  else await prisma.pastPaperFile.create({ data });
  return paper;
}

function escapePdfText(value) {
  return String(value).replace(/([\\()])/g, '\\$1');
}

function buildDemoPdf() {
  const lines = [
    'Moodlelike Agent student answer demo',
    'Question 1',
    demoQuestionPrompt,
    'A. 9    B. 10    C. 11    D. 12',
    'Student work: f(4) = 2 * 4 + 3 = 11',
    'Student answer: C'
  ];
  const commands = lines.map((line, index) => `${index ? '0 -34 Td ' : ''}(${escapePdfText(line)}) Tj`).join('\n');
  const stream = `BT\n/F1 18 Tf\n72 740 Td\n${commands}\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}

function ensureDemoFixtures() {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const { createCanvas } = require('../backend/node_modules/@napi-rs/canvas');
  const canvas = createCanvas(1200, 820);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffdf8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#d9e2ef';
  context.lineWidth = 2;
  for (let y = 110; y < canvas.height; y += 58) {
    context.beginPath(); context.moveTo(55, y); context.lineTo(1145, y); context.stroke();
  }
  context.fillStyle = '#13233a';
  context.font = '700 30px Arial';
  context.fillText('Moodlelike Agent student answer demo', 70, 70);
  context.font = '24px Arial';
  context.fillText('Question 1', 75, 155);
  context.font = '700 34px Arial';
  context.fillText(demoQuestionPrompt, 75, 220);
  context.font = '28px Arial';
  context.fillText('A. 9        B. 10        C. 11        D. 12', 75, 290);
  context.save();
  context.translate(82, 395);
  context.rotate(-0.018);
  context.fillStyle = '#1f5fba';
  context.font = '34px "Segoe Print", "Comic Sans MS", cursive';
  context.fillText('My work:', 0, 0);
  context.fillText('f(4) = 2 x 4 + 3 = 11', 25, 72);
  context.font = '700 42px "Segoe Print", "Comic Sans MS", cursive';
  context.fillText('My answer: C', 25, 155);
  context.restore();
  context.fillStyle = '#667085';
  context.font = '20px Arial';
  context.fillText('Local demo fixture — no real student data', 75, 750);
  fs.writeFileSync(handwrittenFixturePath, canvas.toBuffer('image/png'));
  fs.writeFileSync(pdfFixturePath, buildDemoPdf());
}

async function ensureTrustedDemoQuestion(topic) {
  const existing = await prisma.cscaQuestion.findFirst({ where: { sourceType: 'agent_local_demo' }, orderBy: { id: 'asc' } });
  const data = {
    subject: 'math', topicId: topic.id, sourceType: 'agent_local_demo', syllabusVersion: topic.syllabusVersion, designedDifficulty: 'easy',
    questionType: 'single_choice', prompt: demoQuestionPrompt,
    options: [{ id: 'A', text: '9' }, { id: 'B', text: '10' }, { id: 'C', text: '11' }, { id: 'D', text: '12' }],
    correctAnswer: 'C', explanation: '把 x=4 代入，f(4)=2×4+3=11。',
    knowledgeTags: ['函数求值'], generationMetadata: { marker },
    reviewMetadata: { marker, approvedFor: 'local_agent_attachment_demo' }, status: 'approved'
  };
  return existing
    ? prisma.cscaQuestion.update({ where: { id: existing.id }, data })
    : prisma.cscaQuestion.create({ data });
}

async function ensureAgentPracticeQuestions(topics) {
  // Keep local demo data representative of the real learning experience. Older
  // arithmetic placeholders remain referenced by historical rounds, so retire
  // them instead of deleting rows that may be protected by foreign keys.
  await prisma.cscaQuestion.updateMany({
    where: { sourceType: 'agent_local_demo_practice' },
    data: { status: 'retired' }
  });
  for (const topic of topics) {
    const existingQuestions = await prisma.cscaQuestion.findMany({
      where: { sourceType: 'agent_local_demo_practice', topicId: topic.id },
      orderBy: { id: 'asc' },
      take: 12
    });
    const mathFunctionShiftQuestions = topic.code === 'M-CALC-001'
      ? [
          { prompt: '函数 y=(x-2)² 的图像由 y=x² 怎样平移得到？', options: ['向左平移 2 个单位', '向右平移 2 个单位', '向上平移 2 个单位', '向下平移 2 个单位'], correctAnswer: 'B', explanation: '把 x 替换为 x-2，图像向右平移 2 个单位。', taskFamily: 'horizontal_shift_direction' },
          { prompt: '函数 y=(x+3)² 的图像由 y=x² 怎样平移得到？', options: ['向右平移 3 个单位', '向左平移 3 个单位', '向上平移 3 个单位', '向下平移 3 个单位'], correctAnswer: 'B', explanation: 'x+3=x-(-3)，所以图像向左平移 3 个单位。', taskFamily: 'horizontal_shift_direction' },
          { prompt: '若 y=f(x) 的图像向右平移 4 个单位，新函数是（ ）', options: ['y=f(x+4)', 'y=f(x-4)', 'y=f(x)+4', 'y=f(x)-4'], correctAnswer: 'B', explanation: '图像向右平移 a 个单位，对应把自变量 x 替换为 x-a。', taskFamily: 'horizontal_shift_direction' },
          { prompt: '抛物线 y=(x-5)² 的顶点坐标是（ ）', options: ['(-5,0)', '(5,0)', '(0,5)', '(0,-5)'], correctAnswer: 'B', explanation: '顶点式 y=(x-h)²+k 的顶点为 (h,k)，所以顶点为 (5,0)。', taskFamily: 'vertex_parameter_reading' },
          { prompt: '函数 y=(x+1)²-2 的顶点坐标是（ ）', options: ['(1,-2)', '(-1,-2)', '(-1,2)', '(1,2)'], correctAnswer: 'B', explanation: 'y=(x-(-1))²-2，因此顶点为 (-1,-2)。', taskFamily: 'vertex_parameter_reading' },
          { prompt: '已知抛物线的顶点为 (3,1)，且形状与 y=x² 相同，其解析式是（ ）', options: ['y=(x+3)²+1', 'y=(x-3)²+1', 'y=(x-1)²+3', 'y=(x+1)²-3'], correctAnswer: 'B', explanation: '顶点式 y=(x-h)²+k 中顶点为 (h,k)，代入 (3,1)。', taskFamily: 'vertex_parameter_reading' },
          { prompt: '把 y=x² 的图像先向左平移 2 个单位，再向上平移 1 个单位，所得函数为（ ）', options: ['y=(x-2)²+1', 'y=(x+2)²+1', 'y=(x+1)²+2', 'y=(x-1)²-2'], correctAnswer: 'B', explanation: '向左平移 2 个单位得到 (x+2)²，再向上平移 1 个单位。', taskFamily: 'multi_step_graph_transform' },
          { prompt: '函数 y=(x-1)²-4 的图像相对 y=x² 的平移是（ ）', options: ['左 1、下 4', '右 1、下 4', '右 4、下 1', '左 4、上 1'], correctAnswer: 'B', explanation: 'x-1 表示向右 1 个单位，函数外的 -4 表示向下 4 个单位。', taskFamily: 'multi_step_graph_transform' },
          { prompt: '若把 y=(x+2)² 的图像向右平移 5 个单位，所得函数为（ ）', options: ['y=(x+7)²', 'y=(x-3)²', 'y=(x-7)²', 'y=(x+3)²'], correctAnswer: 'B', explanation: '原顶点横坐标为 -2，向右移动 5 后为 3，所以新函数为 y=(x-3)²。', taskFamily: 'multi_step_graph_transform' },
          { prompt: '某拱门轮廓可写成 y=-(x-h)²+6，最高点位于 x=4。h 的值是（ ）', options: ['-4', '4', '2', '6'], correctAnswer: 'B', explanation: '顶点横坐标就是 h；最高点横坐标为 4，所以 h=4。', taskFamily: 'horizontal_shift_application' },
          { prompt: '一条抛物线轨迹的顶点从 (0,3) 移到 (-2,3)，解析式中的 x 应替换为（ ）', options: ['x-2', 'x+2', 'x-3', 'x+3'], correctAnswer: 'B', explanation: '顶点向左移动 2 个单位，因此自变量替换为 x+2。', taskFamily: 'horizontal_shift_application' },
          { prompt: '传感器曲线 y=f(x) 的峰值出现在 x=1。校准后曲线变为 y=f(x-3)，峰值将出现在（ ）', options: ['x=-2', 'x=4', 'x=3', 'x=-3'], correctAnswer: 'B', explanation: 'f(x-3) 表示整条曲线向右平移 3 个单位，峰值从 1 移到 4。', taskFamily: 'horizontal_shift_application' }
        ]
      : null;
    const demoMathFunctionQuestions = topic.code === 'DEMO-MATH-FUNCTIONS'
      ? [
          { prompt: '已知函数 f(x)=2x+3，则 f(4) 的值是（ ）', options: ['8', '10', '11', '12'], correctAnswer: 'C', explanation: '把 x=4 代入，f(4)=2×4+3=11。' },
          { prompt: '方程 2x-5=9 的解是（ ）', options: ['x=2', 'x=7', 'x=9', 'x=12'], correctAnswer: 'B', explanation: '移项得 2x=14，所以 x=7。' },
          { prompt: '函数 y=√(x-1) 的定义域是（ ）', options: ['x≥1', 'x>1', 'x≤1', '全体实数'], correctAnswer: 'A', explanation: '被开方数必须非负，因此 x-1≥0，即 x≥1。' },
          { prompt: '一次函数 y=3x-2 与 y 轴的交点坐标是（ ）', options: ['(0,3)', '(0,-2)', '(3,0)', '(-2,0)'], correctAnswer: 'B', explanation: '令 x=0，得到 y=-2，所以交点为 (0,-2)。' },
          { prompt: '方程 x²-5x+6=0 的两个根是（ ）', options: ['1 和 6', '2 和 3', '-2 和 -3', '3 和 5'], correctAnswer: 'B', explanation: 'x²-5x+6=(x-2)(x-3)，所以 x=2 或 x=3。' },
          { prompt: '若正比例函数 y=kx 的图像经过点 (2,6)，则 k 的值是（ ）', options: ['2', '3', '4', '6'], correctAnswer: 'B', explanation: '代入点 (2,6)，6=2k，因此 k=3。' }
        ]
      : null;
    const demoMathGeometryQuestions = topic.code === 'DEMO-MATH-GEOMETRY'
      ? [
          { prompt: '经过点 (1,2) 和 (3,6) 的直线斜率是（ ）', options: ['1', '2', '3', '4'], correctAnswer: 'B', explanation: '斜率 k=(6-2)/(3-1)=2。' },
          { prompt: '直线 y=2x+1 与 y 轴的交点是（ ）', options: ['(1,0)', '(0,1)', '(2,0)', '(0,2)'], correctAnswer: 'B', explanation: '令 x=0，得到 y=1，所以交点为 (0,1)。' },
          { prompt: '圆 (x-2)²+(y+1)²=9 的圆心是（ ）', options: ['(-2,1)', '(2,-1)', '(2,1)', '(-2,-1)'], correctAnswer: 'B', explanation: '标准式 (x-a)²+(y-b)²=r² 的圆心为 (a,b)，因此圆心为 (2,-1)。' },
          { prompt: '点 A(1,3) 与点 B(5,7) 的中点坐标是（ ）', options: ['(2,4)', '(3,5)', '(4,6)', '(6,10)'], correctAnswer: 'B', explanation: '中点为 ((1+5)/2,(3+7)/2)=(3,5)。' },
          { prompt: '与直线 y=-3x+2 平行的直线斜率是（ ）', options: ['-3', '-1/3', '1/3', '3'], correctAnswer: 'A', explanation: '两条非重合平行直线的斜率相同，所以斜率为 -3。' },
          { prompt: '点 (2,-1) 到原点的距离是（ ）', options: ['√3', '√5', '3', '5'], correctAnswer: 'B', explanation: '距离为 √(2²+(-1)²)=√5。' }
        ]
      : null;
    const physicsMechanicsQuestions = ['P-MECH-002', 'DEMO-PHYSICS-MECHANICS'].includes(topic.code)
      ? [
          { prompt: '质量为 2 kg 的物体获得 3 m/s² 的加速度，所受合力为（ ）', options: ['3 N', '5 N', '6 N', '9 N'], correctAnswer: 'C', explanation: '由 F=ma，F=2×3=6 N。' },
          { prompt: '物体同时受到向右 10 N 和向左 4 N 的力，合力为（ ）', options: ['14 N，向右', '6 N，向右', '6 N，向左', '4 N，向左'], correctAnswer: 'B', explanation: '相反方向的力相减，10-4=6 N，方向向右。' },
          { prompt: '在合力不变时，物体质量变为原来的 2 倍，加速度将变为原来的（ ）', options: ['1/2', '2 倍', '4 倍', '不变'], correctAnswer: 'A', explanation: '由 a=F/m，质量加倍时加速度减半。' },
          { prompt: '汽车急刹车时乘客会向前倾，主要体现了物体的（ ）', options: ['弹性', '惯性', '重力', '摩擦力'], correctAnswer: 'B', explanation: '乘客身体仍倾向保持原来的运动状态，这是惯性。' },
          { prompt: '取 g=10 N/kg，质量为 2 kg 的物体重力是（ ）', options: ['5 N', '10 N', '20 N', '40 N'], correctAnswer: 'C', explanation: '重力 G=mg=2×10=20 N。' },
          { prompt: '物体所受合力为零时，它可能（ ）', options: ['只能静止', '静止或做匀速直线运动', '一定加速', '一定减速'], correctAnswer: 'B', explanation: '合力为零时加速度为零，物体可静止或保持匀速直线运动。' }
        ]
      : null;
    const chemistryConcentrationQuestions = topic.code === 'C-BASIC-003'
      ? [
          {
            prompt: '25 ℃ 时，某强酸溶液中 c(H⁺)=1.0×10⁻³ mol/L，该溶液的 pH 为（ ）',
            options: ['2', '3', '10', '11'], correctAnswer: 'B',
            explanation: 'pH=-lg c(H⁺)=-lg(1.0×10⁻³)=3。'
          },
          {
            prompt: '将 100 mL、1.0 mol/L 的 NaCl 溶液加水稀释到 500 mL，稀释后 NaCl 的物质的量浓度为（ ）',
            options: ['0.10 mol/L', '0.20 mol/L', '0.50 mol/L', '5.0 mol/L'], correctAnswer: 'B',
            explanation: '稀释前后溶质的物质的量不变，c₂=c₁V₁/V₂=1.0×100/500=0.20 mol/L。'
          },
          {
            prompt: '25 ℃ 时，pH=2 的盐酸与 pH=4 的盐酸相比，前者的 c(H⁺) 是后者的（ ）',
            options: ['2 倍', '10 倍', '100 倍', '1000 倍'], correctAnswer: 'C',
            explanation: 'pH 每相差 1，c(H⁺) 相差 10 倍；相差 2，因此浓度相差 100 倍。'
          },
          {
            prompt: '配制一定物质的量浓度的 NaCl 溶液时，定容后发现液面超过容量瓶刻度线。正确处理方式是（ ）',
            options: ['吸出多余液体', '加入 NaCl 固体', '重新配制', '加热蒸发至刻度线'], correctAnswer: 'C',
            explanation: '液面超过刻度线会导致体积偏大且浓度偏低，无法通过吸液等方式准确补救，应重新配制。'
          },
          {
            prompt: '25 ℃ 时，0.010 mol/L 的一元强碱 NaOH 溶液，其 pH 为（ ）',
            options: ['2', '7', '12', '14'], correctAnswer: 'C',
            explanation: 'c(OH⁻)=10⁻² mol/L，pOH=2；25 ℃ 时 pH+pOH=14，所以 pH=12。'
          },
          {
            prompt: '用容量瓶配制溶液，洗涤后容量瓶内残留少量蒸馏水，对最终浓度的影响是（ ）',
            options: ['偏高', '偏低', '无影响', '无法判断'], correctAnswer: 'C',
            explanation: '定容时最终总体积仍由刻度线确定，容量瓶内少量蒸馏水不改变溶质的量和最终体积，因此无影响。'
          }
        ]
      : null;
    const chemistryRedoxQuestions = topic.code === 'DEMO-CHEM-REDOX'
      ? [
          { prompt: 'KMnO₄ 中 Mn 元素的化合价是（ ）', options: ['+2', '+4', '+6', '+7'], correctAnswer: 'D', explanation: 'K 为 +1、O 为 -2，根据化合价代数和为零可得 Mn 为 +7。' },
          { prompt: '在氧化还原反应中，物质被氧化意味着它（ ）', options: ['得到电子', '失去电子', '化合价降低', '一定与氧气反应'], correctAnswer: 'B', explanation: '被氧化的本质是失去电子，元素化合价升高。' },
          { prompt: '反应 Zn+CuSO₄=ZnSO₄+Cu 中，还原剂是（ ）', options: ['Zn', 'CuSO₄', 'ZnSO₄', 'Cu'], correctAnswer: 'A', explanation: 'Zn 失去电子、化合价升高，因此 Zn 是还原剂。' },
          { prompt: '反应 Cl₂+2Br⁻=2Cl⁻+Br₂ 中，氧化剂是（ ）', options: ['Cl₂', 'Br⁻', 'Cl⁻', 'Br₂'], correctAnswer: 'A', explanation: 'Cl₂ 得到电子生成 Cl⁻，因此 Cl₂ 是氧化剂。' },
          { prompt: 'Fe²⁺ 转化为 Fe³⁺ 的过程中（ ）', options: ['得到 1 个电子', '失去 1 个电子', '得到 2 个电子', '化合价降低'], correctAnswer: 'B', explanation: 'Fe²⁺→Fe³⁺，化合价升高 1，说明失去 1 个电子。' },
          { prompt: '下列反应中属于氧化还原反应的是（ ）', options: ['HCl+NaOH=NaCl+H₂O', 'CaCO₃=CaO+CO₂', '2H₂+O₂=2H₂O', 'AgNO₃+NaCl=AgCl↓+NaNO₃'], correctAnswer: 'C', explanation: 'H 和 O 的化合价发生变化，因此氢气燃烧属于氧化还原反应。' }
        ]
      : null;
    const fixtureQuestions = mathFunctionShiftQuestions
      ?? demoMathFunctionQuestions
      ?? demoMathGeometryQuestions
      ?? physicsMechanicsQuestions
      ?? chemistryConcentrationQuestions
      ?? chemistryRedoxQuestions;
    if (!fixtureQuestions) continue;
    const questionCount = fixtureQuestions.length;
    for (let index = 1; index <= questionCount; index += 1) {
      const fixture = fixtureQuestions[index - 1];
      const prompt = fixture.prompt;
      const values = fixture.options;
      const existing = existingQuestions[index - 1]
        ?? await prisma.cscaQuestion.findFirst({ where: { sourceType: 'agent_local_demo_practice', prompt } });
      const data = {
        subject: topic.subject, topicId: topic.id, sourceType: 'agent_local_demo_practice', syllabusVersion: topic.syllabusVersion, designedDifficulty: index <= 2 ? '基础' : index <= 5 ? '中等' : '较难',
        questionType: 'single_choice', prompt,
        options: values.map((text, optionIndex) => ({ id: String.fromCharCode(65 + optionIndex), text })),
        correctAnswer: fixture.correctAnswer, explanation: fixture.explanation,
        knowledgeTags: [topic.title], generationMetadata: {
          marker,
          purpose: 'agent_practice_golden_path',
          ...(fixture.taskFamily ? { questionPlan: { taskFamily: fixture.taskFamily } } : {})
        },
        reviewMetadata: { marker, approvedFor: 'local_agent_practice_demo' }, status: 'approved'
      };
      if (existing) await prisma.cscaQuestion.update({ where: { id: existing.id }, data });
      else await prisma.cscaQuestion.create({ data });
    }
  }
}

async function ensureFunctionShiftTeachingAsset() {
  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'M-CALC-001' } });
  if (!topic || topic.status !== 'published') return null;
  const asset = await prisma.teachingAsset.upsert({
    where: { stableKey: 'math.function-horizontal-shift' },
    update: { type: 'micro_lesson', subjectCode: 'math', status: 'published' },
    create: { stableKey: 'math.function-horizontal-shift', type: 'micro_lesson', subjectCode: 'math', status: 'published' }
  });
  const payload = {
    schemaVersion: '1',
    title: '看懂函数图像的水平平移',
    summary: '拖动 h，观察 y=(x-h)² 的顶点如何移动，并用自己的判断完成一个即时检查。',
    instructions: [
      '先把 h 调到 0，确认原函数 y=x² 的顶点在 (0,0)。',
      '再把 h 调到正数和负数，比较图像移动方向。',
      '不要背“括号里的符号”；用顶点横坐标等于 h 来判断。'
    ],
    component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 0 } },
    activePrompt: {
      id: 'horizontal-shift-direction-v1',
      prompt: '当 h=3 时，y=(x-h)² 的顶点在哪里？',
      options: [{ id: 'left', label: '(-3, 0)' }, { id: 'right', label: '(3, 0)' }, { id: 'up', label: '(0, 3)' }],
      correctAnswer: 'right',
      correctFeedback: '正确。顶点横坐标就是 h，所以 h=3 时顶点为 (3,0)。',
      incorrectFeedback: '再看一次顶点：令括号 x-h=0，可得 x=h。调整滑块到 3 后重试。'
    },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
  const version = await prisma.teachingAssetVersion.upsert({
    where: { assetId_version: { assetId: asset.id, version: 1 } },
    update: {
      status: 'published', language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
      renderer: 'interactive_component', componentKey: 'math.function-horizontal-shift', componentVersion: '1',
      payloadSchemaVersion: 'function-horizontal-shift-v1', payload,
      fallbackPayload: { title: payload.title, body: '函数 y=(x-h)² 的顶点为 (h,0)：h>0 向右平移，h<0 向左平移。' },
      sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }],
      reviewState: 'local_demo_approved', reviewedAt: new Date(), publishedAt: new Date(), retiredAt: null
    },
    create: {
      assetId: asset.id, version: 1, status: 'published', language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
      renderer: 'interactive_component', componentKey: 'math.function-horizontal-shift', componentVersion: '1',
      payloadSchemaVersion: 'function-horizontal-shift-v1', payload,
      fallbackPayload: { title: payload.title, body: '函数 y=(x-h)² 的顶点为 (h,0)：h>0 向右平移，h<0 向左平移。' },
      sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }],
      reviewState: 'local_demo_approved', reviewedAt: new Date(), publishedAt: new Date()
    }
  });
  await prisma.teachingAssetTopic.upsert({
    where: { assetId_topicId_relationship: { assetId: asset.id, topicId: topic.id, relationship: 'primary' } },
    update: { sortOrder: 0 },
    create: { assetId: asset.id, topicId: topic.id, relationship: 'primary', sortOrder: 0 }
  });
  return { assetId: asset.id, versionId: version.id, stableKey: asset.stableKey, topicId: topic.id };
}

async function ensureNewtonSecondLawTeachingAsset() {
  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'P-MECH-002' } });
  if (!topic || topic.status !== 'published') return null;
  const asset = await prisma.teachingAsset.upsert({
    where: { stableKey: 'physics.newton-second-law' },
    update: { type: 'micro_lesson', subjectCode: 'physics', status: 'published' },
    create: { stableKey: 'physics.newton-second-law', type: 'micro_lesson', subjectCode: 'physics', status: 'published' }
  });
  const payload = {
    schemaVersion: '1',
    title: '用 F=ma 看懂力、质量与加速度',
    summary: '同时调节合力与质量，观察加速度如何响应，并完成一次不泄露答案的即时判断。',
    instructions: [
      '先保持质量不变，只增大合力，观察加速度。',
      '再保持合力不变，只增大质量，比较加速度。',
      '用 a=F/m 解释变化，不把“力大就一定快”当作结论。'
    ],
    component: { key: 'physics.newton-second-law', version: '1', props: { forceMin: 2, forceMax: 20, initialForce: 8, massMin: 1, massMax: 8, initialMass: 2 } },
    activePrompt: {
      id: 'newton-second-law-mass-v1',
      prompt: '合力保持不变，质量变为原来的 2 倍，加速度如何变化？',
      options: [{ id: 'double', label: '变为 2 倍' }, { id: 'half', label: '变为 1/2' }, { id: 'same', label: '保持不变' }],
      correctAnswer: 'half',
      correctFeedback: '正确。a=F/m，合力不变而质量加倍，加速度变为原来的 1/2。',
      incorrectFeedback: '保持 F 不变，在 a=F/m 中把 m 加倍，再观察商如何变化。'
    },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
  const version = await prisma.teachingAssetVersion.upsert({
    where: { assetId_version: { assetId: asset.id, version: 1 } },
    update: {
      status: 'published', language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
      renderer: 'interactive_component', componentKey: 'physics.newton-second-law', componentVersion: '1',
      payloadSchemaVersion: 'newton-second-law-v1', payload,
      fallbackPayload: { title: payload.title, body: '牛顿第二定律 a=F/m：质量不变时合力越大加速度越大；合力不变时质量越大加速度越小。' },
      sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }],
      reviewState: 'local_demo_approved', reviewedAt: new Date(), publishedAt: new Date(), retiredAt: null
    },
    create: {
      assetId: asset.id, version: 1, status: 'published', language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
      renderer: 'interactive_component', componentKey: 'physics.newton-second-law', componentVersion: '1',
      payloadSchemaVersion: 'newton-second-law-v1', payload,
      fallbackPayload: { title: payload.title, body: '牛顿第二定律 a=F/m：质量不变时合力越大加速度越大；合力不变时质量越大加速度越小。' },
      sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }],
      reviewState: 'local_demo_approved', reviewedAt: new Date(), publishedAt: new Date()
    }
  });
  await prisma.teachingAssetTopic.upsert({
    where: { assetId_topicId_relationship: { assetId: asset.id, topicId: topic.id, relationship: 'primary' } },
    update: { sortOrder: 0 }, create: { assetId: asset.id, topicId: topic.id, relationship: 'primary', sortOrder: 0 }
  });
  return { assetId: asset.id, versionId: version.id, stableKey: asset.stableKey, topicId: topic.id };
}

async function ensureNeutralizationTeachingAsset() {
  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'C-BASIC-003' } });
  if (!topic || topic.status !== 'published') return null;
  const asset = await prisma.teachingAsset.upsert({
    where: { stableKey: 'chemistry.acid-base-neutralization' },
    update: { type: 'micro_lesson', subjectCode: 'chemistry', status: 'published' },
    create: { stableKey: 'chemistry.acid-base-neutralization', type: 'micro_lesson', subjectCode: 'chemistry', status: 'published' }
  });
  const payload = {
    schemaVersion: '1',
    title: '用粒子份数看懂酸碱中和',
    summary: '调节 H⁺ 与 OH⁻ 的相对份数，观察酸过量、碱过量和恰好中和三种状态。',
    instructions: [
      '先让 H⁺ 多于 OH⁻，观察反应后剩余粒子。',
      '再让 OH⁻ 多于 H⁺，比较溶液状态。',
      '最后把两者调成相等，理解“一元强酸与一元强碱等物质的量”的边界。'
    ],
    component: { key: 'chemistry.acid-base-neutralization', version: '1', props: { acidMin: 0, acidMax: 10, initialAcid: 6, baseMin: 0, baseMax: 10, initialBase: 4 } },
    activePrompt: {
      id: 'neutralization-equimolar-v1',
      prompt: '一元强酸和一元强碱等物质的量完全反应后，忽略盐的水解，溶液呈什么性质？',
      options: [{ id: 'acidic', label: '酸性' }, { id: 'neutral', label: '中性' }, { id: 'basic', label: '碱性' }],
      correctAnswer: 'neutral',
      correctFeedback: '正确。H⁺ 与 OH⁻ 等物质的量反应生成水，二者均无过量，忽略盐的水解时呈中性。',
      incorrectFeedback: '把 H⁺ 与 OH⁻ 调成相等，观察反应后是否还有一方过量。'
    },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
  const version = await prisma.teachingAssetVersion.upsert({
    where: { assetId_version: { assetId: asset.id, version: 1 } },
    update: {
      status: 'published', language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
      renderer: 'interactive_component', componentKey: 'chemistry.acid-base-neutralization', componentVersion: '1',
      payloadSchemaVersion: 'acid-base-neutralization-v1', payload,
      fallbackPayload: { title: payload.title, body: '一元强酸与一元强碱反应时，比较 H⁺ 和 OH⁻ 的物质的量：谁过量，反应后溶液就由谁主导。' },
      sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }],
      reviewState: 'local_demo_approved', reviewedAt: new Date(), publishedAt: new Date(), retiredAt: null
    },
    create: {
      assetId: asset.id, version: 1, status: 'published', language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
      renderer: 'interactive_component', componentKey: 'chemistry.acid-base-neutralization', componentVersion: '1',
      payloadSchemaVersion: 'acid-base-neutralization-v1', payload,
      fallbackPayload: { title: payload.title, body: '一元强酸与一元强碱反应时，比较 H⁺ 和 OH⁻ 的物质的量：谁过量，反应后溶液就由谁主导。' },
      sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }],
      reviewState: 'local_demo_approved', reviewedAt: new Date(), publishedAt: new Date()
    }
  });
  await prisma.teachingAssetTopic.upsert({
    where: { assetId_topicId_relationship: { assetId: asset.id, topicId: topic.id, relationship: 'primary' } },
    update: { sortOrder: 0 }, create: { assetId: asset.id, topicId: topic.id, relationship: 'primary', sortOrder: 0 }
  });
  return { assetId: asset.id, versionId: version.id, stableKey: asset.stableKey, topicId: topic.id };
}

async function main() {
  assertLocalDatabase();
  const auth = credentials();
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(auth.password), displayName: 'CSCA Demo Student', role: 'student',
      status: 'active', emailVerifiedAt: new Date()
    },
    create: {
      email, passwordHash: await hashPassword(auth.password), displayName: 'CSCA Demo Student', role: 'student',
      status: 'active', emailVerifiedAt: new Date()
    }
  });
  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      educationStageCode: 'high_school', gradeCode: '12', countryCode: 'CN', graduationYear: 2027,
      targetExamDate: new Date('2027-03-15'), targetSubjectCodes: ['math', 'physics', 'chemistry'],
      preferredQuestionLanguageCode: 'zh', examAttemptType: 'first', weeklyGoalDays: 5,
      targetMajorCategoryCode: 'engineering', onboardingCompletedAt: new Date(), metadata: { marker }
    },
    create: {
      userId: user.id, educationStageCode: 'high_school', gradeCode: '12', countryCode: 'CN', graduationYear: 2027,
      targetExamDate: new Date('2027-03-15'), targetSubjectCodes: ['math', 'physics', 'chemistry'],
      preferredQuestionLanguageCode: 'zh', examAttemptType: 'first', weeklyGoalDays: 5,
      targetMajorCategoryCode: 'engineering', onboardingCompletedAt: new Date(), metadata: { marker }
    }
  });

  await prisma.studentScoreGoal.updateMany({
    where: { userId: user.id, status: 'active', examBatchCode: { not: 'agent-local-demo-2027' } },
    data: { status: 'superseded', supersededAt: new Date() }
  });
  let scoreGoal = await prisma.studentScoreGoal.findFirst({
    where: { userId: user.id, examSystemCode: 'csca', examBatchCode: 'agent-local-demo-2027', version: 1 }
  });
  const scoreGoalData = {
    examDate: new Date('2027-03-15'), status: 'active', totalTargetScore: 85,
    availabilityVersion: 'availability:agent-local-demo:v1', scoringPolicyVersion: 'csca-score-policy-v1', source: 'local_demo'
  };
  scoreGoal = scoreGoal
    ? await prisma.studentScoreGoal.update({ where: { id: scoreGoal.id }, data: scoreGoalData })
    : await prisma.studentScoreGoal.create({ data: { userId: user.id, examSystemCode: 'csca', examBatchCode: 'agent-local-demo-2027', version: 1, ...scoreGoalData } });
  await prisma.studentScoreGoalSubject.deleteMany({ where: { goalId: scoreGoal.id } });
  await prisma.studentScoreGoalSubject.createMany({
    data: [
      { goalId: scoreGoal.id, subjectCode: 'math', targetScore: 85, priority: 1 }
    ]
  });
  await prisma.studyAvailabilityPreference.updateMany({ where: { userId: user.id, status: 'active' }, data: { status: 'superseded', supersededAt: new Date() } });
  await prisma.studyAvailabilityPreference.upsert({
    where: { userId_version: { userId: user.id, version: 1 } },
    update: { status: 'active', timezone: 'Asia/Shanghai', weeklyMinutesGoal: 300, preferredStudyDays: [1, 2, 3, 4, 5], defaultSessionMinutes: 20, source: 'local_demo', supersededAt: null },
    create: { userId: user.id, version: 1, status: 'active', timezone: 'Asia/Shanghai', weeklyMinutesGoal: 300, preferredStudyDays: [1, 2, 3, 4, 5], defaultSessionMinutes: 20, source: 'local_demo' }
  });

  const mathWeak = await ensureTopic('math', 'DEMO-MATH-FUNCTIONS', '函数与方程');
  const mathDeveloping = await ensureTopic('math', 'DEMO-MATH-GEOMETRY', '解析几何', 1);
  const physicsDeveloping = await ensureTopic('physics', 'DEMO-PHYSICS-MECHANICS', '力与运动');
  const chemistryStrong = await ensureTopic('chemistry', 'DEMO-CHEM-REDOX', '氧化还原反应');
  const masteryRows = [
    [mathWeak, 0.46, 0.88, 12, 5],
    [mathDeveloping, 0.68, 0.81, 10, 7],
    [physicsDeveloping, 0.62, 0.79, 9, 5],
    [chemistryStrong, 0.84, 0.86, 8, 7]
  ];
  for (const [topic, mastery, confidence, attemptCount, correctCount] of masteryRows) {
    await prisma.userCscaTopicMastery.upsert({
      where: { userId_topicId: { userId: user.id, topicId: topic.id } },
      update: { subject: topic.subject, mastery, confidence, attemptCount, correctCount, lastPracticedAt: new Date('2026-09-13T08:00:00Z') },
      create: { userId: user.id, subject: topic.subject, topicId: topic.id, mastery, confidence, attemptCount, correctCount, lastPracticedAt: new Date('2026-09-13T08:00:00Z') }
    });
  }
  await prisma.cscaWrongPattern.deleteMany({ where: { userId: user.id, patternType: { startsWith: 'demo_' } } });
  await prisma.cscaWrongPattern.createMany({ data: [
    { userId: user.id, subject: 'math', topicId: mathWeak.id, patternType: 'demo_concept_gap', recurrenceCount: 4, lastWrongAt: new Date('2026-09-13T08:00:00Z'), nextReviewAt: new Date('2026-09-15T08:00:00Z'), status: 'active', metadata: { marker } },
    { userId: user.id, subject: 'math', topicId: mathDeveloping.id, patternType: 'demo_calculation_error', recurrenceCount: 2, lastWrongAt: new Date('2026-09-12T08:00:00Z'), nextReviewAt: new Date('2026-09-15T08:00:00Z'), status: 'improving', metadata: { marker } }
  ] });

  const mockPaper = await prisma.mockExamPaper.upsert({
    where: { slug: 'agent-demo-math-mock-1' },
    update: { title: 'CSCA 数学模考 1（本地演示）', description: marker, status: 'published' },
    create: { subject: 'math', slug: 'agent-demo-math-mock-1', title: 'CSCA 数学模考 1（本地演示）', description: marker, language: 'zh', questionCount: 48, durationMinutes: 90, isFree: true, isLocked: false, sortOrder: 999, status: 'published' }
  });
  await prisma.mockExamAttempt.deleteMany({ where: { userId: user.id, paperId: mockPaper.id } });
  await prisma.mockExamAttempt.create({
    data: {
      userId: user.id, paperId: mockPaper.id, language: 'zh', answers: { 1: 'A', 2: 'C', 3: 'B' },
      currentQuestion: 48, score: 78, correctCount: 37, wrongCount: 9, unansweredCount: 2,
      startedAt: new Date('2026-09-12T06:00:00Z'), submittedAt: new Date('2026-09-12T07:18:00Z')
    }
  });
  await ensurePastPaper();
  await ensureTrustedDemoQuestion(mathWeak);
  const teachingAssets = await Promise.all([
    ensureFunctionShiftTeachingAsset(),
    ensureNewtonSecondLawTeachingAsset(),
    ensureNeutralizationTeachingAsset()
  ]);
  const assetTopicIds = teachingAssets.filter(Boolean).map((item) => item.topicId);
  const demoPracticeTopics = await prisma.cscaExamTopic.findMany({
    where: {
      status: 'published',
      OR: [
        { subject: { in: ['math', 'physics', 'chemistry'] } },
        { id: { in: assetTopicIds } }
      ]
    },
    orderBy: { id: 'asc' }
  });
  await ensureAgentPracticeQuestions(demoPracticeTopics.length ? demoPracticeTopics : [mathWeak]);
  const demoQuestionIds = (await prisma.cscaQuestion.findMany({
    where: { sourceType: { in: ['agent_local_demo', 'agent_local_demo_practice'] } },
    select: { id: true }
  })).map((item) => item.id);
  await prisma.cscaQuestionQualityMetric.deleteMany({ where: { questionId: { in: demoQuestionIds } } });
  await prisma.cscaQuestionExposure.deleteMany({ where: { userId: user.id, questionId: { in: demoQuestionIds } } });
  const resetAt = new Date();
  await prisma.cscaAdaptiveRound.updateMany({
    where: { session: { userId: user.id }, submittedAt: null },
    data: { status: 'abandoned' }
  });
  await prisma.cscaAdaptiveSession.updateMany({
    where: { userId: user.id, status: 'active' },
    data: { status: 'completed', completedAt: resetAt }
  });
  ensureDemoFixtures();
  await prisma.agentConversation.deleteMany({ where: { userId: user.id } });

  console.log(JSON.stringify({
    status: 'ready', marker, userId: user.id, email, credentialFile: path.relative(rootDir, credentialPath),
    masteryTopics: masteryRows.length, mathWeakTopic: { id: mathWeak.id, syllabusVersion: mathWeak.syllabusVersion }, reviewItems: 2, mockAttempts: 1, pastPapers: 1, trustedAttachmentQuestions: 1, teachingAssets,
    fixtures: [path.relative(rootDir, handwrittenFixturePath), path.relative(rootDir, pdfFixturePath)]
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
