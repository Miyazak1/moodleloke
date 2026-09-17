const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '西南政法大学',
  nameEn: 'Southwest University of Political Science and Law',
  schoolType: 'regular',
  region: 'Chongqing, Southwest China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；英文授课专业：数学（英文）。',
  cscaRequirementNote: '中文授课选中文试卷。',
  undergradRequirements: '截图显示西南政法大学本科项目以中文授课为主，文科/人文类需文科中文 + 数学；英文授课专业按数学（英文）判断。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 7 月 31 日。',
  round1CloseDate: '2026-07-31',
  applicationSteps: '中文授课专业需选择中文试卷；文科类专业重点准备文科中文与数学。',
  tuitionSummary: '¥18,000 - ¥20,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000 - ¥20,000/年',
    livingCost: '约 ¥1,400/月',
    display: {
      city: 'Chongqing',
      regionLabel: 'Southwest China',
      livingCostLabel: '~¥1,400/月',
      displayProgramCount: 17,
      displayUndergraduateCount: 17,
      visibleProgramCount: 10,
      displaySubjectTags: ['数学', '中文(文科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 17, visibleCount: 10, hiddenNote: '还有 7 个汉语授课专业' }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-07-31',
          label: '本科项目截止',
          dateLabel: 'Jul 31, 2026',
          endDate: '2026-07-31',
          description: '截图显示 Administration Management、Agricultural Mechanical Designing and Manufacturing Automation、Applied Psychology、Bioscience、Biotechnology 等项目截止日期为 2026 年 7 月 31 日。'
        }
      ],
      programFieldTags: [
        'Architecture',
        'Biology',
        'Business Administration',
        'Chemical Engineering',
        'Civil Engineering',
        'Economics',
        'Journalism and Media',
        'Law',
        'Philosophy and Psychology',
        'Dentistry'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,400/月。',
  scholarships: ['西南政法大学来华留学生校长奖学金'],
  englishPrograms: '',
  notablePrograms: 'Administration Management、Agricultural Mechanical Designing and Manufacturing Automation、Applied Psychology、Bioscience、Biotechnology、Business Administration、Civil Engineering、Economics、Finance、International Economics and Trade。截图展示 17 个本科项目中的 10 个。',
  programFields: 'Architecture、Biology、Business Administration、Chemical Engineering、Civil Engineering、Economics、Journalism and Media、Law、Philosophy and Psychology、Dentistry。',
  source: 'csca-reference-screenshot',
  sourceId: 'southwest-university-of-political-science-and-law',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-07-31T00:00:00.000Z');

const basePrograms = [
  ['Administration Management', 'Administration Management', 'Business Administration', ['中文(文科)', '数学'], 18000, '¥18,000/年', '4', false, 1],
  ['Agricultural Mechanical Designing and Manufacturing Automation', 'Agricultural Mechanical Designing and Manufacturing Automation', 'Architecture', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', '4', false, 2],
  ['Applied Psychology', 'Applied Psychology', 'Philosophy and Psychology', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', '4', false, 3],
  ['Bioscience', 'Bioscience', 'Biology', ['中文(理科)', '数学'], 20000, '¥20,000/年', '4', false, 4],
  ['Biotechnology', 'Biotechnology', 'Biology', ['中文(理科)', '数学'], 20000, '¥20,000/年', '4', false, 5],
  ['Business Administration', 'Business Administration', 'Business Administration', ['中文(文科)', '数学'], 18000, '¥18,000/年', '4', false, 6],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', '4', true, 7],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 18000, '¥18,000/年', '4', false, 8],
  ['Finance', 'Finance', 'Economics', ['中文(文科)', '数学'], 18000, '¥18,000/年', '4', false, 9],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', ['中文(文科)', '数学'], 18000, '¥18,000/年', '4', true, 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, durationYears, hasScholarship, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears,
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
  deadlineLabel: 'Jul 31, 2026',
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
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '英文授课专业',
    cscaSubjects: ['数学'],
    languageCondition: '数学（英文）。',
    description: '英文授课专业按数学（英文）判断。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '中文授课项目',
    cscaSubjects: [],
    description: '中文授课选中文试卷。',
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
    name: '西南政法大学来华留学生校长奖学金',
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
    log: { note: '截图显示 17 个本科项目；本脚本录入截图可见 10 个项目、3 条 CSCA 规则和 1 项奖学金。' }
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
