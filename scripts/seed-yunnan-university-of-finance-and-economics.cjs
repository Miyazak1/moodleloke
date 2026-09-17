const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '云南财经大学',
  nameEn: 'Yunnan University of Finance and Economics',
  schoolType: 'regular',
  region: 'Kunming, Southwest China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：数学 + 中文。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示云南财经大学本科项目均为中文授课，财经、法学、新闻传播等方向需中文(文科) + 数学。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 20 日。',
  round1CloseDate: '2026-06-20',
  applicationSteps: '按目标项目确认中文(文科)与数学；截图显示要求已确认。',
  tuitionSummary: '¥16,600/年。',
  tuitionByCategory: {
    chinesePrograms: '¥16,600/年',
    livingCost: '约 ¥1,300/月',
    display: {
      city: 'Kunming',
      regionLabel: 'Southwest China',
      livingCostLabel: '~¥1,300/月',
      displayProgramCount: 7,
      displayUndergraduateCount: 7,
      visibleProgramCount: 7,
      displaySubjectTags: ['数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 7, visibleCount: 7 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-20',
          label: '本科项目截止',
          dateLabel: 'Jun 20, 2026',
          endDate: '2026-06-20',
          description: '截图显示 Accounting、Business Administration、International Economy and Trade、Journalism、Law 等项目截止日期为 2026 年 6 月 20 日。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'Economics',
        'Journalism and Media',
        'Law',
        'Accounting',
        'Biology',
        'Chemistry'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,300/月。',
  scholarships: ['云南财经大学“一带一路”国际工商管理硕士研究生（MBA）奖学金'],
  englishPrograms: '',
  notablePrograms: 'Accounting、Business Administration、International Economy and Trade、Journalism、Law、Marketing、Tourism Management。',
  programFields: 'Business Administration、Economics、Journalism and Media、Law、Accounting、Biology、Chemistry。',
  source: 'csca-reference-screenshot',
  sourceId: 'yunnan-university-of-finance-and-economics',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-20T00:00:00.000Z');

const basePrograms = [
  ['Accounting', 'Accounting', 'Accounting', 1],
  ['Business Administration', 'Business Administration', 'Business Administration', 2],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', 3],
  ['Journalism', 'Journalism', 'Journalism and Media', 4],
  ['Law', 'Law', 'Law', 5],
  ['Marketing', 'Marketing', 'Business Administration', 6],
  ['Tourism Management', 'Tourism Management', 'Business Administration', 7]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects: ['中文(文科)', '数学'],
  cscaRequirement: 'CSCA：中文(文科) + 数学',
  tuitionAmount: 16600,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥16,600/年',
  deadlineDate,
  deadlineLabel: 'Jun 20, 2026',
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
    description: '数学 + 中文。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '要求状态',
    cscaSubjects: [],
    description: '已确认。',
    sortOrder: 2
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
    name: '云南财经大学“一带一路”国际工商管理硕士研究生（MBA）奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '硕士',
    applicableProgram: 'MBA',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
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
    log: { note: '截图显示 7 个本科项目、2 条 CSCA 规则和 1 项奖学金，截止日期为 2026 年 6 月 20 日。' }
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
