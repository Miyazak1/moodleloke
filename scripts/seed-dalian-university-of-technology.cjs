const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/dalian-university-of-technology';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '大连理工大学',
  nameEn: 'Dalian University of Technology',
  rank: 25,
  schoolType: 'regular',
  region: 'Dalian, Northeast China',
  officialWebsite: 'https://www.dlut.edu.cn/',
  applicationSystemUrl: 'http://iso.dlut.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 可免专业中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理或化学。',
  cscaRequirementNote: '汉语言商务；国际教育方向 HSK4 180/210 分以上要求。',
  undergradRequirements: '截图参考页显示大连理工大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先按授课语言和专业方向确认数学、物理或化学科目；HSK4 可免专业中文。',
  tuitionSummary: '¥20,500 - ¥25,500/年。',
  tuitionByCategory: {
    chinesePrograms: '¥20,500/年',
    englishPrograms: '¥25,500/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Dalian',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 12,
      displayUndergraduateCount: 12,
      visibleProgramCount: 12,
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)', '中文(理科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 8, visibleCount: 8 },
        { key: 'english_program', label: '英语授课专业', total: 4, visibleCount: 4 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '部分本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Applied Physics、Architecture (5 Years)、Automation、Biomedical Engineering 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Architecture',
        'Biology',
        'Business Administration',
        'Chemical Engineering',
        'Civil Engineering',
        'Mechanical and Manufacturing Engineering',
        'Physics',
        'Chemistry'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['大连理工大学国际中文教师奖学金', '大连理工大学国际学生校长奖学金'],
  englishPrograms: 'Applied Physics、Chemical Engineering and Technics、Intelligent Construction、Mechanical Design & Manufacturing and Automation。',
  notablePrograms: 'Applied Physics、Chemical Engineering and Technics、Intelligent Construction、Mechanical Design & Manufacturing and Automation、Architecture (5 Years)、Automation、Biomedical Engineering、Business Administration、Civil Engineering、Engineering Mechanics。',
  programFields: 'Architecture、Biology、Business Administration、Chemical Engineering、Civil Engineering、Mechanical and Manufacturing Engineering、Physics、Chemistry。',
  source: 'csca-reference-screenshot',
  sourceId: 'dalian-university-of-technology',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Applied Physics', 'Applied Physics', 'Physics', '英文授课', ['数学', '物理'], 25500, '¥25,500/年', '4', 1, true],
  ['Chemical Engineering and Technics', 'Chemical Engineering and Technics', 'Chemical Engineering', '英文授课', ['数学', '化学'], 25500, '¥25,500/年', '4', 2, false],
  ['Intelligent Construction', 'Intelligent Construction', 'Civil Engineering', '英文授课', ['数学', '物理'], 25500, '¥25,500/年', '4', 3, false],
  ['Mechanical Design & Manufacturing and Automation', 'Mechanical Design & Manufacturing and Automation', 'Mechanical and Manufacturing Engineering', '英文授课', ['数学', '物理'], 25500, '¥25,500/年', '4', 4, false],
  ['Applied Physics', 'Applied Physics', 'Physics', '中文授课', ['中文(理科)', '数学', '物理'], 20500, '¥20,500/年', '4', 5, true],
  ['Architecture (5 Years)', 'Architecture (5 Years)', 'Architecture', '中文授课', ['中文(理科)', '数学', '物理'], 22500, '¥22,500/年', '5', 6, true],
  ['Automation', 'Automation', 'Automation', '中文授课', ['中文(理科)', '数学', '物理'], 20500, '¥20,500/年', '4', 7, true],
  ['Biomedical Engineering', 'Biomedical Engineering', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 20500, '¥20,500/年', '4', 8, true],
  ['Business Administration', 'Business Administration', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 20500, '¥20,500/年', '4', 9, false],
  ['Chemical Engineering & Technology', 'Chemical Engineering & Technology', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 20500, '¥20,500/年', '4', 10, false],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20500, '¥20,500/年', '4', 11, false],
  ['Engineering Mechanics', 'Engineering Mechanics', 'Mechanical and Manufacturing Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20500, '¥20,500/年', '4', 12, false]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder, hasDeadline]) => ({
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
  deadlineDate: hasDeadline ? new Date('2026-06-30T00:00:00.000Z') : undefined,
  deadlineLabel: hasDeadline ? 'Jun 30, 2026' : undefined,
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
    scope: '汉语商务等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工类专业',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理或化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '专业中文',
    cscaSubjects: [],
    languageCondition: 'HSK4 可免专业中文。',
    description: '达到 HSK4 条件可免专业中文。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '汉语言商务与国际教育',
    cscaSubjects: [],
    description: '汉语言商务；国际教育方向 HSK4 180/210 分以上要求。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  {
    name: '大连理工大学国际中文教师奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '大连理工大学国际学生项目',
    requirementText: '奖学金申请条件以学校当年通知为准。',
    sortOrder: 1
  },
  {
    name: '大连理工大学国际学生校长奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '大连理工大学国际学生本科项目',
    requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
    sortOrder: 2
  }
].map((scholarship) => ({
  ...scholarship,
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
    scholarships,
    log: { note: '截图显示共 12 个本科专业；本脚本录入截图可见全部专业、截止日期与奖学金。' }
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
