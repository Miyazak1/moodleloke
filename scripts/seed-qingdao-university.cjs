const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '青岛大学',
  nameEn: 'Qingdao University',
  schoolType: 'regular',
  region: 'Qingdao, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '截图显示青岛大学项目仅需数学。',
  hskMinLevel: null,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：数学；理工科类：数学。',
  cscaRequirementNote: '已确认仅需数学。',
  undergradRequirements: '截图显示青岛大学本科项目包含 1 个英文授课项目和 1 个中文授课项目，CSCA 要求仅需数学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: 'MBBS Program (in English) 截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按授课语言选择项目；截图标注文科/人文类和理工科类均仅需数学。',
  tuitionSummary: '¥27,000 - ¥30,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥27,000/年',
    englishPrograms: '¥30,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Qingdao',
      regionLabel: 'East China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 2,
      displayUndergraduateCount: 3,
      visibleProgramCount: 2,
      displaySubjectTags: ['数学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 1 },
        { key: 'chinese_program', label: '汉语授课专业', total: 1, visibleCount: 1 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-30',
          label: 'MBBS Program (in English)',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 MBBS Program (in English) 截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'MBBS'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['青岛大学“校长奖学金”'],
  englishPrograms: 'MBBS Program (in English)。',
  notablePrograms: 'MBBS Program (in English)、Dual-degree in Chinese language & Business Administration。',
  programFields: 'Business Administration、MBBS。',
  source: 'csca-reference-screenshot',
  sourceId: 'qingdao-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const mbbsDeadlineDate = new Date('2026-06-30T00:00:00.000Z');

const programs = [
  {
    nameZh: 'MBBS Program (in English)',
    nameEn: 'MBBS Program (in English)',
    degreeLevel: '本科',
    durationYears: '6',
    fieldCategory: 'MBBS',
    teachingLanguage: '英文授课',
    cscaSubjects: ['数学', '化学'],
    cscaRequirement: 'CSCA：数学 + 化学',
    tuitionAmount: 30000,
    tuitionCurrency: 'RMB',
    tuitionPeriod: 'year',
    tuitionText: '¥30,000/年',
    deadlineDate: mbbsDeadlineDate,
    deadlineLabel: 'Jun 30, 2026',
    applicationRound: '2026 本科申请',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 1,
    status: SchoolStatus.published
  },
  {
    nameZh: 'Dual-degree in Chinese language & Business Administration',
    nameEn: 'Dual-degree in Chinese language & Business Administration',
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory: 'Business Administration',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    cscaRequirement: 'CSCA：中文(文科) + 数学',
    tuitionAmount: 27000,
    tuitionCurrency: 'RMB',
    tuitionPeriod: 'year',
    tuitionText: '¥27,000/年',
    deadlineDate: null,
    deadlineLabel: null,
    applicationRound: '2026 本科申请',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 2,
    status: SchoolStatus.published
  }
];

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '文科/人文类',
    cscaSubjects: ['数学'],
    description: '数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工科类',
    cscaSubjects: ['数学'],
    description: '数学。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '已确认仅需数学。',
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
    name: '青岛大学“校长奖学金”',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
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
    log: { note: '截图显示 2 个可见本科项目、3 条 CSCA 规则和 1 项奖学金，MBBS 截止日期为 2026 年 6 月 30 日。' }
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
