const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '四川外国语大学',
  nameEn: 'Sichuan International Studies University',
  schoolType: 'regular',
  region: 'Chongqing, Southwest China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '汉语言文学：HSK4 可免专业中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：专业中文 + 数学。',
  cscaRequirementNote: '数学可选中英文。',
  undergradRequirements: '截图显示四川外国语大学本科项目包含英文授课和中文授课；汉语言文学达到 HSK4 可免专业中文，数学可选中英文。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 5 月 30 日。',
  round1CloseDate: '2026-05-30',
  applicationSteps: '按授课语言确认专业中文要求；汉语言文学 HSK4 可免专业中文，数学可选中英文版本。',
  tuitionSummary: '¥17,500 - ¥45,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥17,500/年',
    englishPrograms: '¥36,000 - ¥45,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Chongqing',
      regionLabel: 'Southwest China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 3,
      displayUndergraduateCount: 3,
      visibleProgramCount: 3,
      displaySubjectTags: ['数学', '中文(文科)'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 },
        { key: 'chinese_program', label: '汉语授课专业', total: 1, visibleCount: 1 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-30',
          label: '本科项目截止',
          dateLabel: 'May 30, 2026',
          endDate: '2026-05-30',
          description: '截图显示 Economics、MBBS in English、Stomatology 项目截止日期为 2026 年 5 月 30 日。'
        }
      ],
      programFieldTags: [
        'Dentistry',
        'Economics',
        'MBBS'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['四川外国语大学国际学生校长奖学金'],
  englishPrograms: 'MBBS in English、Stomatology。',
  notablePrograms: 'MBBS in English、Stomatology、Economics。',
  programFields: 'Dentistry、Economics、MBBS。',
  source: 'csca-reference-screenshot',
  sourceId: 'sichuan-international-studies-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-30T00:00:00.000Z');

const basePrograms = [
  ['MBBS in English', 'MBBS in English', 'MBBS', '英文授课', ['数学', '化学'], 45000, '¥45,000/年', '6', 1],
  ['Stomatology', 'Stomatology', 'Dentistry', '英文授课', ['数学', '化学'], 36000, '¥36,000/年', '5', 2],
  ['Economics', 'Economics', 'Economics', '中文授课', ['中文(文科)', '数学'], 17500, '¥17,500/年', '4', 3]
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
    scope: '中文授课专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '专业中文 + 数学。',
    sortOrder: 1
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言文学',
    cscaSubjects: [],
    languageCondition: '汉语言文学：HSK4 可免专业中文。',
    description: '达到 HSK4 可免专业中文。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '数学语种',
    cscaSubjects: [],
    description: '数学可选中英文。',
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
    name: '四川外国语大学国际学生校长奖学金',
    type: 'university',
    coverage: '大学奖学金',
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
    log: { note: '截图显示 3 个本科项目、3 条 CSCA 规则和 1 项奖学金，截止日期为 2026 年 5 月 30 日。' }
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
