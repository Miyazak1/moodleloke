const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '贵州医科大学',
  nameEn: 'Guizhou Medical University',
  schoolType: 'regular',
  region: 'Guiyang, Southwest China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '自费生无需 CSCA。',
  hskMinLevel: null,
  cscaRequired: true,
  cscaRequirement: '理工科类：理科中文 + 数学 + 化学；仅奖学金申请者需要。',
  cscaRequirementNote: '仅奖学金学生需要。',
  undergradRequirements: '截图显示贵州医科大学本科项目包含 1 个英文授课项目和 3 个中文授课项目；CSCA 仅奖学金申请者需要，自费生无需 CSCA。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: null,
  round1CloseDate: null,
  applicationSteps: '申请奖学金项目时按理工科类准备理科中文、数学和化学；自费生按截图提示无需 CSCA。',
  tuitionSummary: '¥25,000/年。',
  tuitionByCategory: {
    chinesePrograms: '截图专业列表显示 0',
    englishPrograms: '¥25,000/年',
    livingCost: '约 ¥1,100/月',
    display: {
      city: 'Guiyang',
      regionLabel: 'Southwest China',
      livingCostLabel: '~¥1,100/月',
      displayProgramCount: 4,
      displayUndergraduateCount: 4,
      visibleProgramCount: 4,
      displaySubjectTags: ['中文(理科)', '数学', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 1 },
        { key: 'chinese_program', label: '汉语授课专业', total: 3, visibleCount: 3 }
      ],
      programFieldTags: [
        'MBBS',
        'Nursing',
        'Pharmacy'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,100/月。',
  scholarships: [],
  englishPrograms: 'Clinical Medicine。',
  notablePrograms: 'Clinical Medicine、Nursing、Pharmacy、Pharmacy Administration。',
  programFields: 'MBBS、Nursing、Pharmacy。',
  source: 'csca-reference-screenshot',
  sourceId: 'guizhou-medical-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Clinical Medicine', 'Clinical Medicine', 'MBBS', '英文授课', ['数学', '化学'], 25000, '¥25,000/年', '6', 1],
  ['Nursing', 'Nursing', 'Nursing', '中文授课', ['中文(理科)', '数学', '化学'], 0, '0', '4', 2],
  ['Pharmacy', 'Pharmacy', 'Pharmacy', '中文授课', ['中文(理科)', '数学', '化学'], 0, '0', '4', 3],
  ['Pharmacy Administration', 'Pharmacy Administration', 'Pharmacy', '中文授课', ['中文(理科)', '数学', '化学'], 0, '0', '4', 4]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears,
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
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
    scope: '仅奖学金申请者',
    cscaSubjects: ['中文(理科)', '数学', '化学'],
    description: '理科中文 + 数学 + 化学；仅奖学金申请者需要。',
    sortOrder: 1
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '自费生',
    cscaSubjects: [],
    languageCondition: '自费生无需 CSCA。',
    description: '自费生无需 CSCA。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '仅奖学金学生需要。',
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
    log: { note: '截图显示 4 个本科项目、3 条 CSCA 规则，无可见奖学金卡片。' }
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
