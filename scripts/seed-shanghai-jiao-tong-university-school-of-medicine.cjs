const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '上海交通大学医学院',
  nameEn: 'Shanghai Jiao Tong University School of Medicine',
  schoolType: 'regular',
  region: 'Shanghai, East China China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '需 HSK 五级 200 分以上；高中阶段汉语授课的申请人可申请免 HSK。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '理工科类：理科中文 + 数学。',
  cscaRequirementNote: '仅招收临床医学和口腔医学两个专业；需参加上海交大统一入学考试；数学、物理、英语。',
  undergradRequirements: '截图显示上海交通大学医学院仅招收 Clinical Medicine 和 Oral Medicine (Dentistry) 两个本科专业，均为中文授课。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: null,
  round1CloseDate: null,
  applicationSteps: '按截图准备理科中文与数学；同时关注上海交大统一入学考试中的数学、物理、英语要求。',
  tuitionSummary: '¥29,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥29,000/年',
    livingCost: '约 ¥4,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China China',
      livingCostLabel: '~¥4,500/月',
      displayProgramCount: 2,
      displayUndergraduateCount: 2,
      visibleProgramCount: 2,
      displaySubjectTags: ['数学', '中文(理科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 2, visibleCount: 2 }
      ],
      programFieldTags: ['Medicine', 'Dentistry']
    }
  },
  accommodationCost: '生活费参考约 ¥4,500/月。',
  scholarships: [],
  englishPrograms: null,
  notablePrograms: 'Clinical Medicine、Oral Medicine (Dentistry)。',
  programFields: 'Medicine、Dentistry。',
  source: 'csca-reference-screenshot',
  sourceId: 'shanghai-jiao-tong-university-school-of-medicine',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Clinical Medicine', 'Clinical Medicine', 'Medicine', ['中文(理科)', '数学', '物理', '化学'], 29000, '¥29,000/年', 1],
  ['Oral Medicine (Dentistry)', 'Oral Medicine (Dentistry)', 'Dentistry', ['中文(理科)', '数学', '物理', '化学'], 29000, '¥29,000/年', 2]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '5',
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: '有奖学金',
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
    scope: '医学类专业',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '中文授课',
    cscaSubjects: [],
    languageCondition: '需 HSK 五级 200 分以上；高中阶段汉语授课的申请人可申请免 HSK。',
    description: '需 HSK 五级 200 分以上；高中阶段汉语授课的申请人可申请免 HSK。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '仅招收临床医学和口腔医学两个专业；需参加上海交大统一入学考试；数学、物理、英语。',
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
    log: { note: '截图显示 2 个本科项目、3 条 CSCA 规则，无可见奖学金卡片。' }
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
