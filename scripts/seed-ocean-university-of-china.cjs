const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/ocean-university-of-china';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '中国海洋大学',
  nameEn: 'Ocean University of China',
  rank: 42,
  schoolType: 'regular',
  region: 'Qingdao, East China',
  officialWebsite: 'https://www.ouc.edu.cn/',
  applicationSystemUrl: 'https://sie.ouc.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '汉语言文学专业：HSK 可免专业中文；其他中文授课项目按学校要求提交中文能力证明。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类以数学为核心；理工科类按专业方向确认数学 + 物理或数学 + 化学。',
  cscaRequirementNote: '中文授课需专业中文（文科/理科）方向判断。',
  undergradRequirements: '截图参考页显示中国海洋大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 10 日。',
  round1CloseDate: '2026-06-10',
  applicationSteps: '先确认项目所属方向，再按数学、物理或化学安排练习；汉语言文学按 HSK 免考政策核对中文科目。',
  tuitionSummary: '¥18,000-¥60,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000/年',
    englishPrograms: '¥23,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Qingdao',
      regionLabel: 'East China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 22,
      displayUndergraduateCount: 22,
      visibleProgramCount: 13,
      hiddenProgramNote: '还有8个汉语授课专业',
      displaySubjectTags: ['数学', '化学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '中文授课项目', total: 18, visibleCount: 10, hiddenNote: '还有8个汉语授课专业' },
        { key: 'english_program', label: '英文授课项目', total: 3, visibleCount: 3 },
        { key: 'chinese_language_program', label: '汉语项目', total: 1, visibleCount: 0 },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'subject-check',
          label: '确认专业方向',
          dateLabel: '申请前确认',
          description: '文科/人文类以数学为核心；理工科类按专业确认物理或化学。'
        },
        {
          key: 'deadline-2026',
          label: '部分本科项目截止',
          dateLabel: 'Jun 10, 2026',
          endDate: '2026-06-10',
          description: 'Accounting、Biology、Business Administration、Business Management、Chemistry 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Biology',
        'Business Administration',
        'Chemistry',
        'Civil Engineering',
        'Economics',
        'Environmental and Ecological Sciences',
        'Law',
        'Mathematics',
        'Mechanical and Manufacturing Engineering',
        'Pharmacy',
        '+2个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['中国海洋大学国际学生奖学金'],
  englishPrograms: 'Business Management。',
  notablePrograms: 'Business Management、Computer Science and Technology、International Economics and Trade、Accounting、Biology、Business Administration、Chemistry、Civil Engineering、Economics (Marine Economics)、Environmental Science、Finance、Industrial Design。',
  programFields: 'Biology、Business Administration、Chemistry、Civil Engineering、Economics、Environmental and Ecological Sciences、Law、Mathematics、Mechanical and Manufacturing Engineering、Pharmacy。',
  source: 'csca-reference-screenshot',
  sourceId: 'ocean-university-of-china',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Business Management', 'Business Management', 'Business Administration', '英文授课', ['数学'], 23000, '¥23,000/年', 1, true],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Computer Science', '英文授课', ['数学', '物理'], 23000, '¥23,000/年', 2, false],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '英文授课', ['数学'], 23000, '¥23,000/年', 3, true],
  ['Accounting', 'Accounting', 'Accounting', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 4, true],
  ['Biology', 'Biology', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 18000, '¥18,000/年', 5, true],
  ['Business Administration', 'Business Administration', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 6, true],
  ['Chemistry', 'Chemistry', 'Chemistry', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 18000, '¥18,000/年', 7, true],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 8, false],
  ['Economics (Marine Economics)', 'Economics (Marine Economics)', 'Economics', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 9, false],
  ['Environmental Science', 'Environmental Science', 'Environmental and Ecological Sciences', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 18000, '¥18,000/年', 10, false],
  ['Finance', 'Finance', 'Economics', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 11, false],
  ['Industrial Design', 'Industrial Design', 'Mechanical and Manufacturing Engineering', '中文授课', ['中文(理科)', '数学'], 18000, '¥18,000/年', 12, false],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 13, false]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder, hasDeadline]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '中文授课' ? '中文授课项目按学校中文能力要求确认。' : undefined,
  englishRequirement: teachingLanguage === '英文授课' ? '英文授课项目按学校英语要求确认。' : undefined,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: hasDeadline ? '有奖学金' : undefined,
  deadlineDate: hasDeadline ? new Date('2026-06-10T00:00:00.000Z') : undefined,
  deadlineLabel: hasDeadline ? 'Jun 10, 2026' : undefined,
  applicationRound: hasDeadline ? '2026 本科申请' : undefined,
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
    scope: '管理、经济、外语、文学、法学、公共管理、艺术等方向',
    cscaSubjects: ['数学'],
    description: '管理、经济、外语、文学、法学、公共管理、艺术等方向以数学为核心，中文授课项目需同步确认中文文科方向。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '电子科学与技术、物理、光电、电子信息、通信、计算机、工程、土木、自动化、数学、化学、化工、药物、生命、食品、海洋、材料、环境等方向',
    cscaSubjects: ['数学', '物理'],
    description: '海洋科学、大气、物理、光电、电子信息、通信、计算机、工程、土木、自动化、数学等方向按数学 + 物理准备。',
    sortOrder: 2
  },
  {
    title: '数学 + 化学',
    category: 'science',
    scope: '化学、化工、药物、生命、食品、海洋、材料、环境等方向',
    cscaSubjects: ['数学', '化学'],
    description: '化学、化工、药物、生命、食品、海洋、材料、环境等方向按数学 + 化学准备。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言文学',
    cscaSubjects: [],
    languageCondition: '汉语言文学：HSK 可免专业中文。',
    description: '汉语言文学项目可按学校政策核对专业中文免考。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '中文授课需专业中文（文科/理科）方向判断。',
    sortOrder: 5
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '中国海洋大学国际学生奖学金',
  type: 'university',
  coverage: '以学校奖学金说明为准',
  applicableDegree: '本科',
  applicableProgram: '中国海洋大学国际学生本科项目',
  amountText: '以学校当年通知为准。',
  requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
}];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示共 22 个本科专业；本脚本录入截图可见专业和截止日期列表。' }
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
