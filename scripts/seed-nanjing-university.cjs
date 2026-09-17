const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/nanjing-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '南京大学',
  nameEn: 'Nanjing University',
  rank: 6,
  schoolType: 'regular',
  region: 'Nanjing, East China',
  officialWebsite: 'https://www.nju.edu.cn/',
  applicationSystemUrl: 'http://istudy.nju.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 可免理科中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：理科中文 + 数学；理工科类：部分专业需物理和/或化学。',
  cscaRequirementNote: '具体各专业要求待发布。',
  undergradRequirements: '截图参考页显示南京大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  applicationSteps: '所有申请者必考；具体各专业要求待发布。',
  tuitionSummary: '¥21,000 - ¥24,000/年。',
  tuitionByCategory: {
    humanities: '¥21,000/年',
    science: '¥24,000/年',
    livingCost: '约 ¥1,800/月',
    display: {
      city: 'Nanjing',
      regionLabel: 'East China',
      livingCostLabel: '~¥1,800/月',
      displayProgramCount: 19,
      displayUndergraduateCount: 19,
      visibleProgramCount: 10,
      hiddenProgramNote: '还有9个汉语授课专业',
      displaySubjectTags: ['中文(理科)', '数学', '化学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 19, visibleCount: 10, hiddenNote: '还有9个汉语授课专业' }
      ],
      programFieldTags: [
        'Architecture',
        'Business Administration',
        'Chemistry',
        'Economics',
        'Journalism and Media',
        'Law',
        'Philosophy and Psychology',
        'Physics'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,800/月。',
  scholarships: [],
  notablePrograms: 'Accounting、Applied Chemistry、Applied Physics、Applied Psychology、Architecture、Business Administration、Chemistry、Economics、Financial Management、Insurance。',
  programFields: 'Architecture、Business Administration、Chemistry、Economics、Journalism and Media、Law、Philosophy and Psychology、Physics。',
  source: 'csca-reference-screenshot',
  sourceId: 'nanjing-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Accounting', 'Accounting', 'Accounting', ['中文(文科)', '数学'], 24000, '¥24,000/年', 1],
  ['Applied Chemistry', 'Applied Chemistry', 'Chemistry', ['中文(理科)', '数学', '物理', '化学'], 24000, '¥24,000/年', 2],
  ['Applied Physics', 'Applied Physics', 'Physics', ['中文(理科)', '数学', '物理'], 24000, '¥24,000/年', 3],
  ['Applied Psychology', 'Applied Psychology', 'Philosophy and Psychology', ['中文(理科)', '数学', '物理'], 21000, '¥21,000/年', 4],
  ['Architecture', 'Architecture', 'Architecture', ['中文(理科)', '数学', '物理'], 24000, '¥24,000/年', 5],
  ['Business Administration', 'Business Administration', 'Business Administration', ['中文(文科)', '数学'], 24000, '¥24,000/年', 6],
  ['Chemistry', 'Chemistry', 'Chemistry', ['中文(理科)', '数学', '物理', '化学'], 24000, '¥24,000/年', 7],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 24000, '¥24,000/年', 8],
  ['Financial Management', 'Financial Management', 'Business Administration', ['中文(文科)', '数学'], 24000, '¥24,000/年', 9],
  ['Insurance', 'Insurance', 'Economics', ['中文(文科)', '数学'], 24000, '¥24,000/年', 10]
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
    scope: '所有申请者必考',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学。所有申请者必考。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '部分专业',
    cscaSubjects: ['物理', '化学'],
    description: '部分专业需物理和/或化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '理科中文',
    cscaSubjects: [],
    languageCondition: 'HSK4 可免理科中文。',
    description: '达到 HSK4 条件可免理科中文。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '专业要求',
    cscaSubjects: [],
    description: '具体各专业要求待发布。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    log: { note: '截图显示共 19 个本科专业；本脚本录入截图可见 10 个。' }
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
