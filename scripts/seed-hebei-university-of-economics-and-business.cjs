const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '河北经贸大学',
  nameEn: 'Hebei University of Economics and Business',
  schoolType: 'regular',
  region: 'Shijiazhuang, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 可免文科中文；汉语言专业。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示河北经贸大学本科项目均为中文授课，财经管理类与汉语言相关方向以文科中文 + 数学为主，部分理工类项目按卡片补充物理。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 5 月 30 日。',
  round1CloseDate: '2026-05-30',
  applicationSteps: '按目标项目确认文科中文、数学与物理组合；汉语言专业 HSK4 可免文科中文。',
  tuitionSummary: '¥16,000 - ¥18,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥16,000 - ¥18,000/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Shijiazhuang',
      regionLabel: 'North China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 13,
      displayUndergraduateCount: 13,
      visibleProgramCount: 10,
      displaySubjectTags: ['数学', '中文(文科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 13, visibleCount: 10, hiddenNote: '还有 3 个汉语授课专业' }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-30',
          label: '本科项目截止',
          dateLabel: 'May 30, 2026',
          endDate: '2026-05-30',
          description: '截图显示 Accounting、Biological Sciences、Business Administration、Calligraphy、Civil Engineering 等项目截止日期为 2026 年 5 月 30 日。'
        }
      ],
      programFieldTags: [
        'Biology',
        'Business Administration',
        'Civil Engineering',
        'Economics',
        'Mechanical and Manufacturing Engineering',
        'Pharmacy'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: [],
  englishPrograms: '',
  notablePrograms: 'Accounting、Biological Sciences、Business Administration、Calligraphy、Civil Engineering、Finance、Finance Management、Human Resource Management、International Economy and Trade、Marketing。截图展示 13 个项目中的 10 个。',
  programFields: 'Biology、Business Administration、Civil Engineering、Economics、Mechanical and Manufacturing Engineering、Pharmacy。',
  source: 'csca-reference-screenshot',
  sourceId: 'hebei-university-of-economics-and-business',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-30T00:00:00.000Z');

const basePrograms = [
  ['Accounting', 'Accounting', 'Economics', ['中文(文科)', '数学'], 16000, '¥16,000/年', 1],
  ['Biological Sciences', 'Biological Sciences', 'Biology', ['中文(文科)', '数学'], 18000, '¥18,000/年', 2],
  ['Business Administration', 'Business Administration', 'Business Administration', ['中文(文科)', '数学'], 16000, '¥16,000/年', 3],
  ['Calligraphy', 'Calligraphy', 'Business Administration', ['中文(文科)', '数学'], 16000, '¥16,000/年', 4],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 5],
  ['Finance', 'Finance', 'Economics', ['中文(文科)', '数学'], 16000, '¥16,000/年', 6],
  ['Finance Management', 'Finance Management', 'Economics', ['中文(文科)', '数学'], 16000, '¥16,000/年', 7],
  ['Human Resource Management', 'Human Resource Management', 'Business Administration', ['中文(文科)', '数学'], 16000, '¥16,000/年', 8],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', ['中文(文科)', '数学'], 16000, '¥16,000/年', 9],
  ['Marketing', 'Marketing', 'Business Administration', ['中文(文科)', '数学'], 16000, '¥16,000/年', 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  deadlineDate,
  deadlineLabel: 'May 30, 2026',
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
    scope: '中文授课专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言专业',
    cscaSubjects: [],
    languageCondition: 'HSK4 可免文科中文。',
    description: '汉语言专业达到 HSK4 可免文科中文。',
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

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships: [],
    log: { note: '截图显示 13 个本科项目；本脚本录入截图可见 10 个项目、3 条 CSCA 规则。' }
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
