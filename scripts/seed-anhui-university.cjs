const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/anhui-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '安徽大学',
  nameEn: 'Anhui University',
  rank: 46,
  schoolType: 'regular',
  region: 'Hefei, East China',
  officialWebsite: 'https://www.ahu.edu.cn/',
  applicationSystemUrl: 'https://sie.ahu.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '汉语言文学专业：HSK4 220 分以上可免文科中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理，或理科中文 + 数学 + 物理 + 化学。',
  cscaRequirementNote: '全部中文授课，必须选中文试卷。',
  undergradRequirements: '截图参考页显示安徽大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: 'Economics 项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先按授课语言确认中文或英文项目；中文授课必须选中文试卷。',
  tuitionSummary: '¥15,000/年。',
  tuitionByCategory: {
    undergraduate: '¥15,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Hefei',
      regionLabel: 'East China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 2,
      displayUndergraduateCount: 2,
      visibleProgramCount: 2,
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)', '中文(理科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '中文授课项目', total: 1, visibleCount: 1 },
        { key: 'english_program', label: '英文授课项目', total: 1, visibleCount: 1 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: 'Economics 项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Economics 中文授课和英文授课项目均显示该截止日期。'
        }
      ],
      programFieldTags: ['Economics']
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['安徽大学外国留学生奖学金'],
  englishPrograms: 'Economics。',
  notablePrograms: 'Economics。',
  programFields: 'Economics。',
  source: 'csca-reference-screenshot',
  sourceId: 'anhui-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Economics', 'Economics', 'Economics', '英文授课', ['数学'], 15000, '¥15,000/年', 1],
  ['Economics', 'Economics', 'Economics', '中文授课', ['中文(文科)', '数学'], 15000, '¥15,000/年', 2]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  deadlineDate: new Date('2026-06-30T00:00:00.000Z'),
  deadlineLabel: 'Jun 30, 2026',
  applicationRound: '2026 本科申请',
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
    scope: '经济、商学、管理、法学、政治、外语、文学、哲学、历史、新闻传播等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。经济、商学、管理、法学、政治、外语、文学、哲学、历史、新闻传播等方向适用。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '数学、物理、电子信息、电气自动化、计算机、互联网、集成电路、大数据、人工智能等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学 + 物理。数学、物理、电子信息、电气自动化、计算机、互联网、集成电路、大数据、人工智能等方向适用。',
    sortOrder: 2
  },
  {
    title: '理科中文 + 数学 + 物理 + 化学',
    category: 'science',
    scope: '化学化工、生命医学、资源环境、材料科学等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '化学化工、生命医学、资源环境、材料科学等方向按理科中文 + 数学 + 物理 + 化学准备。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言文学',
    cscaSubjects: [],
    languageCondition: '汉语言文学专业：HSK4 220 分以上可免文科中文。',
    description: '汉语言文学项目可按学校政策核对文科中文免考。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '中文授课',
    cscaSubjects: [],
    description: '全部中文授课，必须选中文试卷。',
    sortOrder: 5
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '安徽大学外国留学生奖学金',
  type: 'university',
  applicableDegree: '本科',
  applicableProgram: '安徽大学国际学生本科项目',
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
    log: { note: '截图显示共 2 个本科专业；本脚本录入截图可见全部专业、截止日期与奖学金。' }
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
