const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/shanghai-jiao-tong-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '上海交通大学',
  nameEn: 'Shanghai Jiao Tong University',
  rank: 41,
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: 'https://www.sjtu.edu.cn/',
  applicationSystemUrl: 'https://isc.sjtu.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: 'HSK5 级 ≥200 分（书写 ≥60 分）或 HSK6 级 ≥180 分（书写 ≥60 分）；不达标者可申请一年汉语预科。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：数学 + 语文 + 英语；理工科类：数学 + 物理 + 英语。',
  cscaRequirementNote: '预录制 CSCA 面试，并参加上海交通大学国际本科生考试。可先申请后补 CSCA 成绩。',
  undergradRequirements: '预录制 CSCA 面试，并参加上海交通大学国际本科生考试（3月21-22日）。早轮申请：12月8日-2月5日；常规轮申请：2月6日-3月10日。可先申请后补 CSCA 成绩（截止6月30日）。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '早轮申请：2025 年 12 月 8 日至 2026 年 2 月 5 日。',
  round2Deadline: '常规轮申请：2026 年 2 月 6 日至 2026 年 3 月 10 日；CSCA 成绩可补交至 2026 年 6 月 30 日。',
  round1OpenDate: '2025-12-08',
  round1CloseDate: '2026-02-05',
  round2OpenDate: '2026-02-06',
  round2CloseDate: '2026-03-10',
  applicationSteps: '先准备 CSCA 面试和校内本科生考试；如 CSCA 成绩暂未取得，可先提交申请并在截止日期前补交。',
  tuitionSummary: '¥24,800 - ¥29,000/年。',
  tuitionByCategory: {
    undergraduate: '¥24,800/年',
    selectedPrograms: '¥29,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 50,
      displayUndergraduateCount: 50,
      visibleProgramCount: 10,
      hiddenProgramNote: '还有40个汉语授课专业',
      displaySubjectTags: ['中文(理科)', '中文(文科)', '数学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 50, visibleCount: 10, hiddenNote: '还有40个汉语授课专业' }
      ],
      programFieldTags: [
        'Naval Architecture and Ocean Engineering',
        'Civil Engineering',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Computer Science',
        'Materials Science',
        'Aerospace Engineering',
        'Environmental Science',
        'Biomedical Engineering',
        'Mathematics',
        '+13个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: ['上海交通大学奖学金', '2025年上海交通大学（常规批）国际学生本科生招生简章', '留学交大'],
  notablePrograms: 'Naval Architecture and Ocean Engineering、Civil Engineering、Mechanical Engineering、Industrial Engineering、Power and Energy Engineering、Energy Storage Science and Engineering、Electrical Engineering and Automation、Automation、Intelligent Sensing Engineering、Computer Science and Technology。',
  programFields: 'Naval Architecture and Ocean Engineering、Civil Engineering、Mechanical Engineering、Electrical Engineering、Computer Science、Materials Science、Aerospace Engineering、Environmental Science、Biomedical Engineering、Mathematics。',
  source: 'csca-reference-screenshot',
  sourceId: 'shanghai-jiao-tong-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const programNames = [
  'Naval Architecture and Ocean Engineering',
  'Civil Engineering',
  'Mechanical Engineering',
  'Industrial Engineering',
  'Power and Energy Engineering',
  'Energy Storage Science and Engineering',
  'Electrical Engineering and Automation',
  'Automation',
  'Intelligent Sensing Engineering',
  'Computer Science and Technology'
];

const programs = programNames.map((name, index) => ({
  nameZh: name,
  nameEn: name,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory: index === 0
    ? 'Naval Architecture and Ocean Engineering'
    : index === 1
      ? 'Civil Engineering'
      : index <= 3
        ? 'Mechanical Engineering'
        : index <= 8
          ? 'Electrical Engineering'
          : 'Computer Science',
  teachingLanguage: '中文授课',
  cscaSubjects: ['中文(理科)', '数学'],
  cscaRequirement: 'CSCA：中文(理科) + 数学',
  tuitionAmount: 24800,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥24,800/年',
  scholarshipText: '有奖学金',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: index + 1,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '人文社科类',
    cscaSubjects: ['数学', '语文', '英语'],
    description: '文科/人文类按数学、语文和英语准备。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工农医类',
    cscaSubjects: ['数学', '物理', '英语'],
    description: '理工科类按数学、物理和英语准备。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '中文授课本科项目',
    cscaSubjects: [],
    languageCondition: 'HSK5 级 ≥200 分（书写 ≥60 分）或 HSK6 级 ≥180 分（书写 ≥60 分）；不达标者可申请一年汉语预科。',
    description: '申请前需按目标项目确认 HSK 分数和书写要求。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '申请流程与补交 CSCA',
    cscaSubjects: [],
    description: '预录制 CSCA 面试，并参加上海交通大学国际本科生考试；可先申请后补 CSCA 成绩，截止 6 月 30 日。',
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
    name: '上海交通大学奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '上海交通大学国际学生本科项目',
    requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
    sortOrder: 1
  },
  {
    name: '2025年上海交通大学（常规批）国际学生本科生招生简章',
    type: 'government',
    coverage: '政府奖学金',
    applicableDegree: '本科',
    applicableProgram: '上海交通大学国际学生本科项目',
    requirementText: '奖学金与申请要求以当年招生简章为准。',
    sortOrder: 2
  },
  {
    name: '留学交大',
    type: 'csc',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '上海交通大学国际学生项目',
    requirementText: '具体申请条件以留学交大页面和当年通知为准。',
    sortOrder: 3
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
    log: { note: '截图显示共 50 个本科专业；本脚本录入截图可见 10 个。' }
  });
  const school = await prisma.school.findFirst({ where: { nameZh: schoolData.nameZh }, select: { id: true } });
  const csc = await prisma.scholarship.findFirst({ where: { title: '中国政府奖学金（CSC）' }, select: { id: true } });
  if (school && csc) {
    await prisma.scholarshipSchool.deleteMany({ where: { schoolId: school.id, scholarshipId: csc.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
