const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '天津财经大学',
  nameEn: 'Tianjin University of Finance and Economics',
  schoolType: 'regular',
  region: 'Tianjin, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：中文 + 数学。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示天津财经大学本科项目均为中文授课，财经管理类专业需中文(文科) + 数学。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 5 月 30 日。',
  round1CloseDate: '2026-05-30',
  applicationSteps: '按目标项目确认中文(文科)与数学；截图显示要求已确认。',
  tuitionSummary: '¥16,600/年。',
  tuitionByCategory: {
    chinesePrograms: '¥16,600/年',
    livingCost: '约 ¥1,600/月',
    display: {
      city: 'Tianjin',
      regionLabel: 'North China',
      livingCostLabel: '~¥1,600/月',
      displayProgramCount: 6,
      displayUndergraduateCount: 6,
      visibleProgramCount: 6,
      displaySubjectTags: ['数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 6, visibleCount: 6 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-30',
          label: '本科项目截止',
          dateLabel: 'May 30, 2026',
          endDate: '2026-05-30',
          description: '截图显示 Business Administration、International Business、International Economics and trade、Logistics management、Marketing 等项目截止日期为 2026 年 5 月 30 日。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'Economics'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,600/月。',
  scholarships: [],
  englishPrograms: '',
  notablePrograms: 'Business Administration、International Business、International Economics and trade、Logistics management、Marketing、Tourism Management。',
  programFields: 'Business Administration、Economics。',
  source: 'csca-reference-screenshot',
  sourceId: 'tianjin-university-of-finance-and-economics',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-30T00:00:00.000Z');

const basePrograms = [
  ['Business Administration', 'Business Administration', 'Business Administration', 1],
  ['International Business', 'International Business', 'Business Administration', 2],
  ['International Economics and trade', 'International Economics and trade', 'Economics', 3],
  ['Logistics management', 'Logistics management', 'Business Administration', 4],
  ['Marketing', 'Marketing', 'Business Administration', 5],
  ['Tourism Management', 'Tourism Management', 'Business Administration', 6]
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
    scope: '财经管理类中文授课专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '中文 + 数学。',
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

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships: [],
    log: { note: '截图显示 6 个本科项目、2 条 CSCA 规则，截止日期为 2026 年 5 月 30 日。' }
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
