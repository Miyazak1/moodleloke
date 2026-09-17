const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/central-university-of-finance-and-economics';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '中央财经大学',
  nameEn: 'Central University of Finance and Economics',
  rank: 49,
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: 'https://www.cufe.edu.cn/',
  applicationSystemUrl: 'https://iso.cufe.edu.cn/',
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图参考页显示中央财经大学本科项目按文科/人文类判断 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 9 日。',
  round1CloseDate: '2026-06-09',
  applicationSteps: '所有截图可见项目均为中文授课，按文科中文 + 数学准备。',
  tuitionSummary: '¥22,000/年。',
  tuitionByCategory: {
    undergraduate: '¥22,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 5,
      displayUndergraduateCount: 5,
      visibleProgramCount: 5,
      displaySubjectTags: ['数学', '中文(文科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jun 9, 2026',
          endDate: '2026-06-09',
          description: 'Business Administration、Finance、International Trade and Economics、Marketing(Big Data and Marketing)、Public Administration 均显示该截止日期。'
        }
      ],
      programFieldTags: ['Business Administration', 'Economics']
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: ['中央财经大学本科国际学生奖学金'],
  notablePrograms: 'Business Administration、Finance、International Trade and Economics、Marketing(Big Data and Marketing)、Public Administration。',
  programFields: 'Business Administration、Economics。',
  source: 'csca-reference-screenshot',
  sourceId: 'central-university-of-finance-and-economics',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Business Administration', 'Business Administration', 'Business Administration', 1],
  ['Finance', 'Finance', 'Economics', 2],
  ['International Trade and Economics', 'International Trade and Economics', 'Economics', 3],
  ['Marketing(Big Data and Marketing)', 'Marketing(Big Data and Marketing)', 'Business Administration', 4],
  ['Public Administration', 'Public Administration', 'Business Administration', 5]
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
  tuitionAmount: 22000,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥22,000/年',
  deadlineDate: new Date('2026-06-09T00:00:00.000Z'),
  deadlineLabel: 'Jun 9, 2026',
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
    scope: '财经管理类项目',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '已确认。',
    sortOrder: 2
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '中央财经大学本科国际学生奖学金',
  type: 'university',
  applicableDegree: '本科',
  applicableProgram: '中央财经大学国际学生本科项目',
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
    log: { note: '截图显示共 5 个本科专业；本脚本录入截图可见全部专业、截止日期与奖学金。' }
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
