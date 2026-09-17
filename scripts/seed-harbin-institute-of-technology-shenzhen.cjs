const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '哈尔滨工业大学深圳',
  nameEn: 'Harbin Institute of Technology Shenzhen',
  schoolType: 'regular',
  region: 'Shenzhen, South China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '理工科类：数学 + 物理；计算机科学英文授课。',
  cscaRequirementNote: '其他专业待定。',
  undergradRequirements: '截图显示哈尔滨工业大学深圳本科项目以理工科为主，核心科目为数学 + 物理；计算机科学为英文授课，其他专业待定。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 5 月 31 日。',
  round1CloseDate: '2026-05-31',
  applicationSteps: '优先按项目卡片确认数学、物理等科目；其他待定专业建议人工复核。',
  tuitionSummary: '¥20,000 - ¥26,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥20,000/年',
    englishPrograms: '¥26,000/年',
    livingCost: '约 ¥2,800/月',
    display: {
      city: 'Shenzhen',
      regionLabel: 'South China',
      livingCostLabel: '~¥2,800/月',
      displayProgramCount: 19,
      displayUndergraduateCount: 19,
      visibleProgramCount: 10,
      displaySubjectTags: ['数学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 18, visibleCount: 10, hiddenNote: '还有 8 个汉语授课专业' },
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 0 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-31',
          label: '部分本科项目截止',
          dateLabel: 'May 31, 2026',
          endDate: '2026-05-31',
          description: '截图显示 Accounting、Applied Chemistry、Applied Physics、Architecture、Artificial Intelligence 等项目截止日期为 2026 年 5 月 31 日。'
        }
      ],
      programFieldTags: [
        'Architecture',
        'Biology',
        'Business Administration',
        'Chemistry',
        'Civil Engineering',
        'Economics',
        'Law',
        'Physics',
        'Urban Planning'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,800/月。',
  scholarships: [
    '哈尔滨工业大学优秀外国留学生新生奖学金',
    '哈尔滨工业大学外国留学生庆洪奖学金'
  ],
  englishPrograms: 'Computer Science and Technology。',
  notablePrograms: 'Accounting、Applied Chemistry、Applied Physics、Architecture、Artificial Intelligence、Bioinformatics、Biological Engineering、Bionic Science and Engineering、Business Management、Finance。截图展示 19 个本科项目中的 10 个。',
  programFields: 'Architecture、Biology、Business Administration、Chemistry、Civil Engineering、Economics、Law、Physics、Urban Planning。',
  source: 'csca-reference-screenshot',
  sourceId: 'harbin-institute-of-technology-shenzhen',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-31T00:00:00.000Z');

const basePrograms = [
  ['Accounting', 'Accounting', 'Accounting', ['中文(文科)', '数学'], 20000, '¥20,000/年', false, 1],
  ['Applied Chemistry', 'Applied Chemistry', 'Chemistry', ['中文(理科)', '数学', '物理', '化学'], 20000, '¥20,000/年', false, 2],
  ['Applied Physics', 'Applied Physics', 'Physics', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', false, 3],
  ['Architecture', 'Architecture', 'Architecture', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', true, 4],
  ['Artificial Intelligence', 'Artificial Intelligence', 'Computer Science', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', true, 5],
  ['Bioinformatics', 'Bioinformatics', 'Biology', ['中文(文科)', '数学'], 20000, '¥20,000/年', false, 6],
  ['Biological Engineering', 'Biological Engineering', 'Biology', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', false, 7],
  ['Bionic Science and Engineering', 'Bionic Science and Engineering', 'Biology', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', false, 8],
  ['Business Management', 'Business Management', 'Business Administration', ['中文(文科)', '数学'], 20000, '¥20,000/年', false, 9],
  ['Finance', 'Finance', 'Economics', ['中文(文科)', '数学'], 20000, '¥20,000/年', false, 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, hasScholarship, sortOrder]) => ({
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
  scholarshipText: hasScholarship ? '有奖学金' : undefined,
  deadlineDate,
  deadlineLabel: 'May 31, 2026',
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
    scope: '计算机科学英文授课',
    cscaSubjects: ['数学', '物理'],
    description: '数学 + 物理。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '其他专业',
    cscaSubjects: [],
    description: '其他专业待定。',
    sortOrder: 2
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
    name: '哈尔滨工业大学优秀外国留学生新生奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 1,
    status: SchoolStatus.published
  },
  {
    name: '哈尔滨工业大学外国留学生庆洪奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
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
    log: { note: '截图显示 19 个本科项目；本脚本录入截图可见 10 个项目、2 条 CSCA 规则和 2 项奖学金。' }
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
