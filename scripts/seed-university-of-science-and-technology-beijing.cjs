const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京科技大学',
  nameEn: 'University of Science and Technology Beijing',
  rank: 44,
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '中文授课需 HSK4 级及以上；英文授课需 IELTS 5.5 或 TOEFL 70 及以上。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理或化学；英文授课专业按英文考试要求确认。',
  cscaRequirementNote: '211 重点大学；材料科学、冶金工程全国顶尖；2 个英文授课专业。',
  undergradRequirements: '截图显示北京科技大学本科项目按文科/人文类、理工科类和中英文授课项目分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '先按目标专业确认授课语言、CSCA 科目和语言成绩要求；英文授课项目重点核对 IELTS/TOEFL 和英文考试科目。',
  tuitionSummary: '¥23,300/年。',
  tuitionByCategory: {
    chinesePrograms: '¥23,300/年',
    englishPrograms: '¥23,300/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 49,
      displayUndergraduateCount: 49,
      visibleProgramCount: 12,
      hiddenProgramNote: '还有37个汉语授课专业',
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 },
        { key: 'chinese_program', label: '汉语授课专业', total: 47, visibleCount: 10, hiddenNote: '还有37个汉语授课专业' },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '部分本科项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: 'Accounting、Applied Chemistry、Applied Physics、Biotechnology、Business Administration 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Mining Engineering',
        'Safety Engineering',
        'Civil Engineering',
        'Metallurgy',
        'Materials Science',
        'Mechanical Engineering',
        'Energy Engineering',
        'Environmental Science',
        'Automation',
        'Artificial Intelligence',
        '+9个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: ['北京科技大学 “一带一路” 优秀本科生奖学金'],
  englishPrograms: 'Materials Science and Engineering (English)、Environmental Engineering (English)。',
  notablePrograms: 'Materials Science and Engineering (English)、Environmental Engineering (English)、Safety Engineering、Mining Engineering、Mineral Processing Engineering、Engineering Mechanics、Occupational Health Engineering、Intelligent Mining Engineering、Intelligent Construction、Civil Engineering、Building Environment and Energy Application Engineering、Construction Management。',
  programFields: 'Mining Engineering、Safety Engineering、Civil Engineering、Metallurgy、Materials Science、Mechanical Engineering、Energy Engineering、Environmental Science、Automation、Artificial Intelligence。',
  source: 'csca-reference-screenshot',
  sourceId: 'university-of-science-and-technology-beijing',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Materials Science and Engineering (English)', 'Materials Science and Engineering (English)', 'Materials Science', '英文授课', ['数学', '物理'], 1],
  ['Environmental Engineering (English)', 'Environmental Engineering (English)', 'Environmental Science', '英文授课', ['数学', '物理'], 2],
  ['Safety Engineering', 'Safety Engineering', 'Safety Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 3],
  ['Mining Engineering', 'Mining Engineering', 'Mining Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 4],
  ['Mineral Processing Engineering', 'Mineral Processing Engineering', 'Mining Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 5],
  ['Engineering Mechanics', 'Engineering Mechanics', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 6],
  ['Occupational Health Engineering', 'Occupational Health Engineering', 'Safety Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 7],
  ['Intelligent Mining Engineering', 'Intelligent Mining Engineering', 'Mining Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 8],
  ['Intelligent Construction', 'Intelligent Construction', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 9],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 10],
  ['Building Environment and Energy Application Engineering', 'Building Environment and Energy Application Engineering', 'Energy Engineering', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 11],
  ['Construction Management', 'Construction Management', 'Civil Engineering', '中文授课', ['中文(文科)', '数学'], 12]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课项目按英语成绩要求确认。' : '中文授课 HSK4 级及以上。',
  englishRequirement: teachingLanguage === '英文授课' ? 'IELTS 5.5 或 TOEFL 70 及以上。' : undefined,
  tuitionAmount: 23300,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥23,300/年',
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
    scope: '日语、德语、行政管理、社会工作、法学、会计学、国际经济与贸易、金融工程、大数据管理与应用、信息管理与信息系统、视觉传达设计等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学（英语）；日语、德语、行政管理、社会工作、法学、会计学、国际经济与贸易、金融工程、大数据管理与应用、信息管理与信息系统、视觉传达设计等专业按此准备。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '其他理工类专业、英文授课材料科学与工程、环境工程等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理或化学（其他理工类专业）；英文授课专业（材料科学与工程、环境工程）数学为英文考试。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '中英文授课本科项目',
    cscaSubjects: [],
    languageCondition: '中文授课需 HSK4 级及以上；英文授课需 IELTS 5.5，TOEFL 70 及以上。',
    description: '中文授课需 HSK4 级及以上；英文授课需 IELTS 5.5，TOEFL 70 及以上。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '211 重点大学；材料科学、冶金工程全国顶尖；2 个英文授课专业。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '北京科技大学 “一带一路” 优秀本科生奖学金',
  type: 'university',
  coverage: '全额资助',
  applicableDegree: '本科',
  applicableProgram: '北京科技大学国际学生本科项目',
  amountText: '以学校当年通知为准。',
  requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
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
    log: { note: '截图显示共 49 个本科专业；本脚本录入截图可见 12 个专业、截止日期摘要和 1 项奖学金。' }
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
