const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '哈尔滨工程大学',
  nameEn: 'Harbin Engineering University',
  schoolType: 'regular',
  region: 'Harbin, Northeast China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：中文 + 数学；理工科类：数学 + 物理。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示哈尔滨工程大学本科项目中文授课，文科/人文类需中文 + 数学，工程类专业需数学 + 物理。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '中文授课项目按专业方向确认中文、数学、物理或化学组合；工程类专业重点准备数学与物理。',
  tuitionSummary: '¥17,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥17,000/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Harbin',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 9,
      displayUndergraduateCount: 9,
      visibleProgramCount: 9,
      displaySubjectTags: ['数学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 9, visibleCount: 9 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-15',
          label: '本科项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: '截图显示 Business Administration、Chemical Engineering and Technology、Civil Engineering、Economics、Electronic Commerce 等项目截止日期为 2026 年 6 月 15 日。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'Chemical Engineering',
        'Civil Engineering',
        'Economics',
        'Mechanical and Manufacturing Engineering'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: ['哈尔滨工程大学外国留学生奖学金'],
  englishPrograms: '',
  notablePrograms: 'Business Administration、Chemical Engineering and Technology、Civil Engineering、Economics、Electronic Commerce、Finance、Machine Design Manufacturing and Automation、Naval Architecture and Ocean Engineering、Public Administration。',
  programFields: 'Business Administration、Chemical Engineering、Civil Engineering、Economics、Mechanical and Manufacturing Engineering。',
  source: 'csca-reference-screenshot',
  sourceId: 'harbin-engineering-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-15T00:00:00.000Z');

const basePrograms = [
  ['Business Administration', 'Business Administration', 'Business Administration', ['中文(文科)', '数学'], 1],
  ['Chemical Engineering and Technology', 'Chemical Engineering and Technology', 'Chemical Engineering', ['中文(理科)', '数学', '物理', '化学'], 2],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', ['中文(理科)', '数学', '物理'], 3],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 4],
  ['Electronic Commerce', 'Electronic Commerce', 'Business Administration', ['中文(理科)', '数学', '物理'], 5],
  ['Finance', 'Finance', 'Economics', ['中文(文科)', '数学'], 6],
  ['Machine Design Manufacturing and Automation', 'Machine Design Manufacturing and Automation', 'Mechanical and Manufacturing Engineering', ['中文(理科)', '数学', '物理'], 7],
  ['Naval Architecture and Ocean Engineering', 'Naval Architecture and Ocean Engineering', 'Civil Engineering', ['中文(理科)', '数学', '物理'], 8],
  ['Public Administration', 'Public Administration', 'Business Administration', ['中文(文科)', '数学'], 9]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount: 17000,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥17,000/年',
  deadlineDate,
  deadlineLabel: 'Jun 15, 2026',
  applicationRound: '2026 本科申请',
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
    scope: '艺术管理类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '工程类专业',
    cscaSubjects: ['数学', '物理'],
    description: '数学 + 物理。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '要求状态',
    cscaSubjects: [],
    description: '已确认。',
    sortOrder: 3
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  {
    name: '哈尔滨工程大学外国留学生奖学金',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '本科',
    requirementText: '具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 1,
    status: SchoolStatus.published
  }
];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 9 个本科项目、3 条 CSCA 规则和 1 项奖学金，截止日期为 2026 年 6 月 15 日。' }
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
