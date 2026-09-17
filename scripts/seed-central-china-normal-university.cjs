const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/central-china-normal-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '华中师范大学',
  nameEn: 'Central China Normal University',
  rank: 48,
  schoolType: 'regular',
  region: 'Wuhan, Central China',
  officialWebsite: 'https://www.ccnu.edu.cn/',
  applicationSystemUrl: 'https://iso.ccnu.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '汉语言专业：HSK4 可免专业中文；英文授课免专业中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学 + 物理或化学；理工科类：文科中文 + 数学。',
  cscaRequirementNote: '分文科中文和理科中文两类。',
  undergradRequirements: '截图参考页显示华中师范大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先按目标专业确认文科中文或理科中文类别，再准备数学及对应理化科目。',
  tuitionSummary: '¥20,000/年。',
  tuitionByCategory: {
    undergraduate: '¥20,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Wuhan',
      regionLabel: 'Central China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 7,
      displayUndergraduateCount: 7,
      visibleProgramCount: 7,
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 7, visibleCount: 7 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '部分本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Business Management、Economics、Financial Accounting Education、International Economics and Trade、Physical Education 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Accounting',
        'Business Administration',
        'Economics',
        'Philosophy and Psychology',
        'Physical Education',
        'Engineering',
        'Science',
        'Medicine',
        'Management',
        'Law',
        '+37个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['华中师范大学留学华师新生奖学金'],
  notablePrograms: 'Business Management、Economics、Financial Accounting Education、International Economics and Trade、Physical Education、Psychology、Tourism Management。',
  programFields: 'Accounting、Business Administration、Economics、Philosophy and Psychology、Physical Education、Engineering、Science、Medicine、Management、Law。',
  source: 'csca-reference-screenshot',
  sourceId: 'central-china-normal-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Business Management', 'Business Management', 'Business Administration', ['中文(文科)', '数学'], 1],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 2],
  ['Financial Accounting Education', 'Financial Accounting Education', 'Accounting', ['中文(文科)', '数学'], 3],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', ['中文(文科)', '数学'], 4],
  ['Physical Education', 'Physical Education', 'Physical Education', ['中文(文科)', '数学'], 5],
  ['Psychology', 'Psychology', 'Philosophy and Psychology', ['中文(理科)', '数学', '物理'], 6],
  ['Tourism Management', 'Tourism Management', 'Management', ['中文(文科)', '数学'], 7]
];

const deadlineNames = new Set([
  'Business Management',
  'Economics',
  'Financial Accounting Education',
  'International Economics and Trade',
  'Physical Education'
]);

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount: 20000,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥20,000/年',
  deadlineDate: deadlineNames.has(nameZh) ? new Date('2026-06-30T00:00:00.000Z') : undefined,
  deadlineLabel: deadlineNames.has(nameZh) ? 'Jun 30, 2026' : undefined,
  applicationRound: deadlineNames.has(nameZh) ? '2026 本科申请' : undefined,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '地理科学、地理信息科学、运动、电子信息、通信、集成电路、房地产、金融工程、经济学、数学经济、信息管理、电子商务、大数据管理、计算机、软件、信息安全等方向',
    cscaSubjects: ['中文(文科)', '数学', '物理', '化学'],
    description: '文科中文 + 数学 + 物理或化学。地理科学、地理信息科学、运动、电子信息、通信、集成电路、房地产、金融工程、经济学、数学经济、信息管理、电子商务、大数据管理、计算机、软件、信息安全等方向适用。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '美术、设计、旅游、历史、教育、思政、马克思主义、人力资源、财务会计、信息资源管理、社会学、社会工作、体育、音乐、舞蹈、行政管理、土地资源、网络新媒体等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。美术、设计、旅游、历史、教育、思政、马克思主义、人力资源、财务会计、信息资源管理、社会学、社会工作、体育、音乐、舞蹈、行政管理、土地资源、网络新媒体等方向适用。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言专业、英文授课',
    cscaSubjects: [],
    languageCondition: '汉语言专业：HSK4 可免专业中文；英文授课免专业中文。',
    description: '汉语言专业和英文授课项目可按截图参考页政策核对专业中文免考。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '文科中文/理科中文',
    cscaSubjects: [],
    description: '分文科中文和理科中文两类。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '华中师范大学留学华师新生奖学金',
  type: 'university',
  applicableDegree: '本科',
  applicableProgram: '华中师范大学国际学生本科项目',
  requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
}];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示共 7 个本科专业；本脚本录入截图可见全部专业、截止日期与奖学金。' }
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
