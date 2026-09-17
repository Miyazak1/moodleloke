const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京体育大学',
  nameEn: 'Beijing Sport University',
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 级及以上。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学。',
  cscaRequirementNote: 'HSK4 级及以上；211 工程、双一流高校；20 个本科专业，14 个文科类、6 个理科类。',
  undergradRequirements: '截图显示北京体育大学本科项目均为中文授课，文科/人文类需文科中文与数学，理工科类需理科中文与数学。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 1 日。',
  round1CloseDate: '2026-06-01',
  applicationSteps: '按专业类别选择文科中文或理科中文，并准备数学；截图提示 HSK4 级及以上。',
  tuitionSummary: '¥25,000 - ¥28,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥25,000 - ¥28,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 20,
      displayUndergraduateCount: 20,
      visibleProgramCount: 10,
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 20, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-01',
          label: '本科项目截止',
          dateLabel: 'Jun 1, 2026',
          endDate: '2026-06-01',
          description: '截图显示 Physical Education、Sports Training、Football Major、Winter Sports、Tourism Management 等项目截止日期为 2026 年 6 月 1 日。'
        }
      ],
      programFieldTags: [
        'Physical Education',
        'Sports Science',
        'Sports Management',
        'Journalism',
        'Psychology',
        'Engineering',
        'Art',
        'Rehabilitation'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [],
  englishPrograms: null,
  notablePrograms: 'Physical Education、Sports Training、Football Major、Winter Sports、Tourism Management、Leisure Sports、Sports Somatic Science、Martial Arts and Traditional Ethnic Sports、Management of Sports Economics、Public Affairs Management。',
  programFields: 'Physical Education、Sports Science、Sports Management、Journalism、Psychology、Engineering、Art、Rehabilitation。',
  source: 'csca-reference-screenshot',
  sourceId: 'beijing-sport-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-01T00:00:00.000Z');

const basePrograms = [
  ['Physical Education', 'Physical Education', 'Physical Education', ['中文(文科)', '数学'], 25000, '¥25,000/年', 1],
  ['Sports Training', 'Sports Training', 'Sports Science', ['中文(文科)', '数学'], 25000, '¥25,000/年', 2],
  ['Football Major', 'Football Major', 'Sports Science', ['中文(文科)', '数学'], 25000, '¥25,000/年', 3],
  ['Winter Sports', 'Winter Sports', 'Sports Science', ['中文(文科)', '数学'], 25000, '¥25,000/年', 4],
  ['Tourism Management', 'Tourism Management', 'Sports Management', ['中文(文科)', '数学'], 25000, '¥25,000/年', 5],
  ['Leisure Sports', 'Leisure Sports', 'Sports Science', ['中文(文科)', '数学'], 25000, '¥25,000/年', 6],
  ['Sports Somatic Science', 'Sports Somatic Science', 'Sports Science', ['中文(文科)', '数学'], 28000, '¥28,000/年', 7],
  ['Martial Arts and Traditional Ethnic Sports', 'Martial Arts and Traditional Ethnic Sports', 'Physical Education', ['中文(文科)', '数学'], 25000, '¥25,000/年', 8],
  ['Management of Sports Economics', 'Management of Sports Economics', 'Sports Management', ['中文(文科)', '数学'], 25000, '¥25,000/年', 9],
  ['Public Affairs Management', 'Public Affairs Management', 'Sports Management', ['中文(文科)', '数学'], 25000, '¥25,000/年', 10]
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
  deadlineLabel: 'Jun 1, 2026',
  applicationRound: '2026 本科申请',
  scholarshipText: '有奖学金',
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
    scope: '文科/人文类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工科类',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: 'HSK4 级及以上；211 工程、双一流高校；20 个本科专业；14 个文科类、6 个理科类。',
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
    log: { note: '截图显示 20 个本科项目，录入 10 个可见项目、3 条 CSCA 规则，截止日期为 2026 年 6 月 1 日。' }
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
