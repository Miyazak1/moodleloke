const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '燕山大学',
  nameEn: 'Yanshan University',
  schoolType: 'regular',
  region: 'Qinhuangdao, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 级及以上；英语授课专业需 IELTS 5.5、TOEFL 85、GRE 300 或 Duolingo 105。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学，部分专业需物理/化学。',
  cscaRequirementNote: '河北省重点大学；有英语授课专业；学费较低（15700 元/年）。',
  undergradRequirements: '截图显示燕山大学本科项目包含 1 个英文授课项目和 12 个中文授课项目；文科类需文科中文与数学，理工科类需理科中文、数学并按专业匹配物理或化学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '中文授课项目需 HSK4 级及以上；英语授课专业按截图准备 IELTS、TOEFL、GRE 或 Duolingo 成绩。',
  tuitionSummary: '¥15,700/年。',
  tuitionByCategory: {
    chinesePrograms: '¥15,700/年',
    englishPrograms: '¥15,700/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Qinhuangdao',
      regionLabel: 'North China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 13,
      displayUndergraduateCount: 13,
      visibleProgramCount: 11,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 1 },
        { key: 'chinese_program', label: '汉语授课专业', total: 12, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-15',
          label: '部分项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: '截图显示 Electronic Science and Technology、Economics and Finance、Business Administration、Accounting、Tourism Management 等项目截止日期为 2026 年 6 月 15 日。'
        }
      ],
      programFieldTags: [
        'Engineering',
        'Economics',
        'Management',
        'Law',
        'Literature',
        'Foreign Languages'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: ['燕山大学外国留学生博士奖学金', '燕山大学外国留学生硕士奖学金'],
  englishPrograms: 'Electronic Science and Technology。',
  notablePrograms: 'Electronic Science and Technology、Economics and Finance、Business Administration、Accounting、Tourism Management、E-commerce、Industrial Engineering、Japanese、Law、Chinese Language and Literature、Teaching Chinese to Speakers of Other Languages。',
  programFields: 'Engineering、Economics、Management、Law、Literature、Foreign Languages。',
  source: 'csca-reference-screenshot',
  sourceId: 'yanshan-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-15T00:00:00.000Z');

const basePrograms = [
  ['Electronic Science and Technology', 'Electronic Science and Technology', 'Engineering', '英文授课', ['数学', '物理'], 15700, '¥15,700/年', 1, true],
  ['Economics and Finance', 'Economics and Finance', 'Economics', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 2, true],
  ['Business Administration', 'Business Administration', 'Management', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 3, true],
  ['Accounting', 'Accounting', 'Management', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 4, true],
  ['Tourism Management', 'Tourism Management', 'Management', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 5, true],
  ['E-commerce', 'E-commerce', 'Management', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 6, true],
  ['Industrial Engineering', 'Industrial Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 15700, '¥15,700/年', 7, true],
  ['Japanese', 'Japanese', 'Foreign Languages', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 8, true],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 9, true],
  ['Chinese Language and Literature', 'Chinese Language and Literature', 'Literature', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 10, true],
  ['Teaching Chinese to Speakers of Other Languages', 'Teaching Chinese to Speakers of Other Languages', 'Literature', '中文授课', ['中文(文科)', '数学'], 15700, '¥15,700/年', 11, true]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder, hasScholarship]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  deadlineDate: sortOrder <= 5 ? deadlineDate : null,
  deadlineLabel: sortOrder <= 5 ? 'Jun 15, 2026' : null,
  applicationRound: '2026 本科申请',
  scholarshipText: hasScholarship ? '有奖学金' : null,
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
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学；部分专业需物理/化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '语言要求',
    cscaSubjects: [],
    languageCondition: 'HSK4 级及以上；英语授课专业需 IELTS 5.5、TOEFL 85、GRE 300 或 Duolingo 105。',
    description: 'HSK4 级及以上；英语授课专业需 IELTS 5.5、TOEFL 85、GRE 300 或 Duolingo 105。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '河北省重点大学；有英语授课专业；学费较低（15700 元/年）。',
    sortOrder: 4
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
    name: '燕山大学外国留学生博士奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '博士',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 1,
    status: SchoolStatus.published
  },
  {
    name: '燕山大学外国留学生硕士奖学金',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '硕士',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 2,
    status: SchoolStatus.published
  }
];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 13 个本科项目，录入 11 个可见项目、4 条 CSCA 规则和 2 项奖学金。' }
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
