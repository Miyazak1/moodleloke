const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '辽宁中医药大学',
  nameEn: 'Liaoning University of Traditional Chinese Medicine',
  schoolType: 'regular',
  region: 'Shenyang, Northeast China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '理工科类：理科中文 + 数学；中文试卷。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示辽宁中医药大学本科项目按理工科类要求判断，核心科目为理科中文 + 数学，项目卡片另按专业补充化学、物理等科目。',
  languageOfInstruction: ['Chinese', 'English'],
  applicationSteps: '按授课语言和项目卡片确认中文(理科)、数学、化学、物理等科目；截图未展示具体截止日期。',
  tuitionSummary: '¥18,000 - ¥38,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000/年',
    englishPrograms: '¥38,000/年',
    livingCost: '约 ¥1,300/月',
    display: {
      city: 'Shenyang',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,300/月',
      displayProgramCount: 22,
      displayUndergraduateCount: 22,
      visibleProgramCount: 22,
      displaySubjectTags: ['中文(理科)', '数学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 14, visibleCount: 14 },
        { key: 'chinese_program', label: '汉语授课专业', total: 8, visibleCount: 8 }
      ],
      programFieldTags: [
        'Accounting',
        'Business Administration',
        'Chemistry',
        'Economics',
        'Law',
        'Mathematics',
        'Pharmacy',
        'Physics',
        'Tourism Management'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,300/月。',
  scholarships: [],
  englishPrograms: 'Accounting、Applied Chemistry、Applied Physics、Business Administration、Chemistry、Economics、International Economy and Trade、Law、Material Chemistry、Mathematics and Applied Mathematics、National Economic Accounting、Pharmacy Engineering、Physics、Tourism Management。',
  notablePrograms: 'Accounting、Applied Chemistry、Applied Physics、Business Administration、Chemistry、Economics、International Economy and Trade、Law、Material Chemistry、Mathematics and Applied Mathematics、National Economic Accounting、Pharmacy Engineering、Physics、Tourism Management。',
  programFields: 'Accounting、Business Administration、Chemistry、Economics、Law、Mathematics、Pharmacy、Physics、Tourism Management。',
  source: 'csca-reference-screenshot',
  sourceId: 'liaoning-university-of-traditional-chinese-medicine',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const englishPrograms = [
  ['Accounting', 'Accounting', 'Accounting', ['数学'], 1],
  ['Applied Chemistry', 'Applied Chemistry', 'Chemistry', ['数学', '化学'], 2],
  ['Applied Physics', 'Applied Physics', 'Physics', ['数学', '物理'], 3],
  ['Business Administration', 'Business Administration', 'Business Administration', ['数学'], 4],
  ['Chemistry', 'Chemistry', 'Chemistry', ['数学', '化学'], 5],
  ['Economics', 'Economics', 'Economics', ['数学'], 6],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', ['数学'], 7],
  ['Law', 'Law', 'Law', ['数学'], 8],
  ['Material Chemistry', 'Material Chemistry', 'Chemistry', ['数学', '化学'], 9],
  ['Mathematics and Applied Mathematics', 'Mathematics and Applied Mathematics', 'Mathematics', ['数学'], 10],
  ['National Economic Accounting', 'National Economic Accounting', 'Accounting', ['数学'], 11],
  ['Pharmacy Engineering', 'Pharmacy Engineering', 'Pharmacy', ['数学', '化学'], 12],
  ['Physics', 'Physics', 'Physics', ['数学', '物理'], 13],
  ['Tourism Management', 'Tourism Management', 'Tourism Management', ['数学'], 14]
];

const chinesePrograms = [
  ['Business Administration', 'Business Administration', 'Business Administration', ['中文(文科)', '数学'], 15],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 16],
  ['Finance', 'Finance', 'Economics', ['中文(文科)', '数学'], 17],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', ['中文(文科)', '数学'], 18],
  ['International Politics', 'International Politics', 'Law', ['中文(文科)', '数学'], 19],
  ['Law', 'Law', 'Law', ['中文(文科)', '数学'], 20],
  ['Mathematics and Applied Mathematics', 'Mathematics and Applied Mathematics', 'Mathematics', ['中文(理科)', '数学', '物理'], 21],
  ['Physics', 'Physics', 'Physics', ['中文(理科)', '数学', '物理'], 22]
];

const programs = [
  ...englishPrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, sortOrder]) => ({
    nameZh,
    nameEn,
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory,
    teachingLanguage: '英文授课',
    cscaSubjects,
    cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
    tuitionAmount: 38000,
    tuitionCurrency: 'RMB',
    tuitionPeriod: 'year',
    tuitionText: '¥38,000/年',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder,
    status: SchoolStatus.published
  })),
  ...chinesePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, sortOrder]) => ({
    nameZh,
    nameEn,
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory,
    teachingLanguage: '中文授课',
    cscaSubjects,
    cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
    tuitionAmount: 18000,
    tuitionCurrency: 'RMB',
    tuitionPeriod: 'year',
    tuitionText: '¥18,000/年',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder,
    status: SchoolStatus.published
  }))
];

const cscaRules = [
  {
    title: '理工科类',
    category: 'science',
    scope: '中文试卷',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学。',
    languageCondition: '中文试卷。',
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
    log: { note: '截图显示 22 个本科项目，其中英文授课 14 个、中文授课 8 个；本脚本完整录入可见项目。' }
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
