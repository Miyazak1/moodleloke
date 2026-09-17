const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_LABEL = '截图参考信息';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '浙江大学',
  nameEn: 'Zhejiang University',
  rank: 3,
  schoolType: 'regular',
  region: 'Hangzhou, East China',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/Zhejiang_University_Logo.svg/240px-Zhejiang_University_Logo.svg.png',
  officialWebsite: 'https://www.zju.edu.cn/',
  applicationSystemUrl: 'https://isinfosys.zju.edu.cn/recruit/login.shtml',
  admissionLevel: ['本科', '硕士', '博士'],
  hskRequirement: '汉语言文学专业：HSK4（含）以上可免文科中文；英文授课项目可免专业中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类按专业方向要求理科中文 + 数学 + 物理、化学或物理 + 化学。',
  cscaRequirementNote: '仅限本科生线上申请，不接受纸质材料；录取结果预计 2026 年 6 月底公布。',
  undergradRequirements: '截图显示浙江大学本科项目按文科/人文类、理工科类和 HSK/英文授课免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分项目截止：2026 年 5 月 31 日。',
  round1CloseDate: '2026-05-31',
  applicationSteps: '仅限本科生线上申请，不接受纸质材料；请按目标专业方向确认 CSCA 科目与语言免考条件。',
  tuitionSummary: '¥19,800 - ¥42,800/年。',
  tuitionByCategory: {
    chinesePrograms: '¥19,800 - ¥24,800/年',
    englishPrograms: '¥24,800 - ¥42,800/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Hangzhou',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 31,
      displayUndergraduateCount: 28,
      visibleProgramCount: 20,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 4, visibleCount: 4 },
        { key: 'chinese_program', label: '汉语授课专业', total: 27, visibleCount: 16, hiddenNote: '还有 11 个汉语授课专业' }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-31',
          label: '部分英文授课/双学位项目截止',
          dateLabel: 'May 31, 2026',
          endDate: '2026-05-31',
          description: '截图显示 ZJU-UoE Dual Degree Biomedical Sciences、Clinical Medicine MBBS 等项目接近截止。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'Chemistry',
        'Clinical Medicine',
        'Computer Science',
        'Economics and Management',
        'Education',
        'International Relations',
        'Management',
        'Law',
        'Architecture',
        'Biology',
        'History'
      ]
    }
  },
  applicationFee: '申请费 ¥800；艺术类、特殊项目或全英文项目费用以项目页面为准。',
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [
    '中国政府奖学金国别双边项目（CSC Type A）',
    '浙江省政府来华留学生奖学金',
    'ZJU-UoE 双学位项目新生奖学金',
    '浙江大学国际联合商学院全球传播与管理项目新生奖学金',
    '浙江大学“一带一路”国际医学院 MBBS 项目新生奖学金'
  ],
  englishPrograms: 'Applied Mathematics and Informatics、Business Management in Innovation, Entrepreneurship and Global Leadership、Clinical Medicine MBBS (6 Years)、ZJU-UoE Dual Degree Biomedical Sciences。',
  notablePrograms: 'Applied Mathematics and Informatics、Business Administration、Clinical Medicine MBBS (6 Years)、International Economics and Trade、Machine Intelligence and Robotics、Law、Architecture、Biological Engineering、Ecology、Education、History。符合截图展示的 31 个可选项目概览。',
  campusFacilities: '申请材料仅限线上提交；不接受纸质材料；录取结果预计 2026 年 6 月底公布。',
  programFields: 'Business Administration、Chemistry、Clinical Medicine、Computer Science、Economics and Management、Education、International Relations、Management、Law、Architecture、Biology、History。',
  contactTel: '+86 571 87951456',
  contactEmail: 'admission2@zju.edu.cn',
  contactAddress: '中国杭州市浙江大学紫金港校区西区国际教育学院大楼416室，邮政编码310058。',
  source: 'csca-reference-screenshot',
  sourceId: 'zhejiang-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-31T00:00:00.000Z');

const basePrograms = [
  ['Applied Mathematics and Informatics', 'Applied Mathematics and Informatics', '本科', '4', 'Computer Science', '英文授课', ['数学', '物理'], 24800, '¥24,800/年', true, '有奖学金', 1],
  ['Doctor of Philosophy in Business Data Science', 'Doctor of Philosophy in Business Data Science', '博士', '4', 'Business Administration', '英文授课', ['数学'], 42800, '¥42,800/年', true, '有奖学金', 2],
  ['Business Management in Innovation, Entrepreneurship and Global Leadership', 'Business Management in Innovation, Entrepreneurship and Global Leadership', '本科', '4', 'Business Administration', '英文授课', ['数学'], 42800, '¥42,800/年', true, '有奖学金', 3],
  ['Clinical Medicine MBBS (6 Years)', 'Clinical Medicine MBBS (6 Years)', '本科', '6', 'Clinical Medicine', '英文授课', ['数学', '化学'], 42800, '¥42,800/年', true, '有奖学金', 4],
  ['Business Administration', 'Business Administration', '本科', '4', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', false, '', 5],
  ['International Economics and Trade', 'International Economics and Trade', '本科', '4', 'Economics and Management', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', false, '', 6],
  ['Machine Intelligence and Robotics', 'Machine Intelligence and Robotics', '本科', '4', 'Computer Science', '英文授课', ['数学', '物理'], 42800, '¥42,800/年', true, '有奖学金', 7],
  ['ZJU-UoE Dual Degree Biomedical Sciences', 'ZJU-UoE Dual Degree Biomedical Sciences', '本科', '4', 'Biology', '英文授课', ['数学', '化学'], 42800, '¥42,800/年', true, '有奖学金', 8],
  ['Law', 'Law', '本科', '4', 'Law', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', false, '', 9],
  ['Architecture', 'Architecture', '本科', '5', 'Architecture', '中文授课', ['中文(理科)', '数学', '物理'], 24800, '¥24,800/年', false, '', 10],
  ['Biological Engineering', 'Biological Engineering', '本科', '4', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 24800, '¥24,800/年', false, '', 11],
  ['Ecology', 'Ecology', '本科', '4', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 24800, '¥24,800/年', false, '', 12],
  ['Economics and Management Experiment Class', 'Economics and Management Experiment Class', '本科', '4', 'Economics and Management', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', false, '', 13],
  ['Economics (International Economy and Trade)', 'Economics (International Economy and Trade)', '本科', '4', 'Economics and Management', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', false, '', 14],
  ['Education', 'Education', '本科', '4', 'Education', '中文授课', ['中文(文科)', '数学'], 19800, '¥19,800/年', false, '', 15],
  ['History', 'History', '本科', '4', 'History', '中文授课', ['中文(文科)', '数学'], 19800, '¥19,800/年', false, '', 16],
  ['Humanities Experiment Class', 'Humanities Experiment Class', '本科', '4', 'Literature', '中文授课', ['中文(文科)', '数学'], 19800, '¥19,800/年', false, '', 17],
  ['Chemistry', 'Chemistry', '本科', '4', 'Chemistry', '中文授课', ['中文(理科)', '数学', '化学'], 24800, '¥24,800/年', false, '', 18],
  ['International Relations', 'International Relations', '硕士', '2', 'International Relations', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', false, '', 19],
  ['Computer Science and Technology', 'Computer Science and Technology', '本科', '4', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 24800, '¥24,800/年', false, '', 20]
];

const programs = basePrograms.map(([nameZh, nameEn, degreeLevel, durationYears, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, hasDeadline, scholarshipText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel,
  durationYears,
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: scholarshipText || undefined,
  deadlineDate: hasDeadline ? deadlineDate : undefined,
  deadlineLabel: hasDeadline ? 'May 31, 2026' : undefined,
  applicationRound: hasDeadline ? '2026 申请季' : undefined,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '哲学、文学、历史、艺术、经济、管理、教育、法学、新闻传播等',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理学、工学、农学、医学等',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学 + 物理。',
    sortOrder: 2
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '化学、材料、化工、生物、环境、医药等',
    cscaSubjects: ['中文(理科)', '数学', '化学'],
    description: '理科中文 + 数学 + 化学。',
    sortOrder: 3
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '工科实验班、医学试验班、临床医学等',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理 + 化学。',
    sortOrder: 4
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言类与英文授课项目',
    cscaSubjects: [],
    languageCondition: '汉语言文学专业：HSK4（含）以上可免文科中文；英文授课项目可免专业中文。',
    description: '符合语言免考条件的项目可按截图规则免考对应专业中文。',
    sortOrder: 5
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '本科线上申请',
    cscaSubjects: [],
    description: '仅限本科生线上申请，不接受纸质材料；录取结果预计 2026 年 6 月底公布。',
    sortOrder: 6
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  ['中国政府奖学金国别双边项目（CSC Type A）', 'csc', '全额资助', '本科/硕士/博士', '以 CSC Type A 渠道说明为准。', 1],
  ['浙江省政府来华留学生奖学金', 'government', '奖学金资助', '本科', '具体资助与申请条件以当年通知为准。', 2],
  ['ZJU-UoE 双学位项目新生奖学金', 'university', '大学奖学金', '本科', '适用于 ZJU-UoE 双学位项目。', 3],
  ['浙江大学国际联合商学院全球传播与管理项目新生奖学金', 'university', '大学奖学金', '本科', '适用于 Business Management in Innovation, Entrepreneurship and Global Leadership。', 4],
  ['浙江大学“一带一路”国际医学院 MBBS 项目新生奖学金', 'university', '大学奖学金', '本科', '适用于 Clinical Medicine MBBS (6 Years)。', 5]
].map(([name, type, coverage, applicableDegree, requirementText, sortOrder]) => ({
  name,
  type,
  coverage,
  applicableDegree,
  requirementText,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 31 个可选项目；本脚本录入截图可见 20 个项目、CSCA 规则、申请费、联系信息与 5 项奖学金。' }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
