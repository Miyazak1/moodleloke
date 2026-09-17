const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '哈尔滨理工大学',
  nameEn: 'Harbin University of Science and Technology',
  schoolType: 'regular',
  region: 'Harbin, Northeast China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '理工科类：理科中文 + 数学；中文。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示哈尔滨理工大学本科项目均为中文授课，理工科类以中文(理科) + 数学为核心，项目卡片补充物理等科目。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按目标项目确认中文(文科/理科)、数学和物理组合；截图显示要求已确认。',
  tuitionSummary: '¥15,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥15,000/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Harbin',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 5,
      displayUndergraduateCount: 5,
      visibleProgramCount: 5,
      displaySubjectTags: ['中文(理科)', '数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-30',
          label: '本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 Accounting、Automation、International Economy and Trade、Marketing、Mechanical Design,Manufacture and Its Automation 项目截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Economics',
        'Mechanical and Manufacturing Engineering'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: [],
  englishPrograms: '',
  notablePrograms: 'Accounting、Automation、International Economy and Trade、Marketing、Mechanical Design,Manufacture and Its Automation。',
  programFields: 'Economics、Mechanical and Manufacturing Engineering。',
  source: 'csca-reference-screenshot',
  sourceId: 'harbin-university-of-science-and-technology',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');

const basePrograms = [
  ['Accounting', 'Accounting', 'Economics', ['中文(文科)', '数学'], 1],
  ['Automation', 'Automation', 'Mechanical and Manufacturing Engineering', ['中文(理科)', '数学', '物理'], 2],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', ['中文(文科)', '数学'], 3],
  ['Marketing', 'Marketing', 'Economics', ['中文(文科)', '数学'], 4],
  ['Mechanical Design,Manufacture and Its Automation', 'Mechanical Design,Manufacture and Its Automation', 'Mechanical and Manufacturing Engineering', ['中文(理科)', '数学', '物理'], 5]
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
  tuitionAmount: 15000,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥15,000/年',
  deadlineDate,
  deadlineLabel: 'Jun 30, 2026',
  applicationRound: '2026 本科申请',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '理工科类',
    category: 'science',
    scope: '中文授课项目',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学。',
    languageCondition: '中文。',
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
    log: { note: '截图显示 5 个本科项目、2 条 CSCA 规则，截止日期为 2026 年 6 月 30 日。' }
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
