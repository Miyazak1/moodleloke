const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '西安交通大学',
  nameEn: "Xi'an Jiaotong University",
  rank: 10,
  schoolType: 'regular',
  region: "Xi'an, Northwest China",
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '汉语言（商务方向）、汉语言文学专业 HSK4 级 180 分以上可免考文科中文；英文授课项目按英语成绩要求确认。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理、化学或数学，按专业方向确认。',
  cscaRequirementNote: 'C9 联盟成员；985；211 双一流；中国大学排名第 10；5 个英文授课本科；英文工程类学费较高。',
  undergradRequirements: '截图显示西安交通大学本科项目按文科/人文类、理工科类和中英文授课项目分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先按目标专业确认文理科分类、授课语言、CSCA 科目和语言成绩要求；英文授课项目重点核对英语成绩和学费。',
  tuitionSummary: '¥20,000 - ¥180,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥20,000/年',
    englishPrograms: '¥80,000 - ¥180,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: "Xi'an",
      regionLabel: 'Northwest China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 49,
      displayUndergraduateCount: 43,
      visibleProgramCount: 15,
      hiddenProgramNote: '还有34个汉语授课专业',
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 5, visibleCount: 5 },
        { key: 'chinese_program', label: '汉语授课专业', total: 44, visibleCount: 10, hiddenNote: '还有34个汉语授课专业' },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '部分本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Materials Science and Engineering、Materials Science and Engineering (English)、Electrical Engineering and Automation、Electrical Engineering and Automation (English)、Energy Internet Engineering 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Electronic Engineering',
        'Mechanical Engineering',
        'Computer Science',
        'Electrical Engineering',
        'Software Engineering',
        'Materials Science',
        'Chemistry',
        'Energy Engineering',
        'Environmental Science',
        'Nuclear Engineering',
        '+10个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: [
    '西安交通大学-西安市政府 “一带一路” 外国留学生奖学金',
    '西安交通大学中国政府奖学金（自主招生研究生）',
    '西安交通大学发展中国家学生奖学金'
  ],
  englishPrograms: 'Materials Science and Engineering (English)、Electrical Engineering and Automation (English)、Intelligent Manufacturing Engineering (English)、Energy and Power Engineering (English)、Clinical Medicine MBBS (English)。',
  notablePrograms: 'Materials Science and Engineering (English)、Electrical Engineering and Automation (English)、Intelligent Manufacturing Engineering (English)、Energy and Power Engineering (English)、Clinical Medicine MBBS (English)、Materials Science and Engineering、Electrical Engineering and Automation、Energy Internet Engineering、Computer Science and Technology、Electronic Science and Technology、Software Engineering、Law、Public Administration、Big Data Management and Application、Business Administration。',
  programFields: 'Electronic Engineering、Mechanical Engineering、Computer Science、Electrical Engineering、Software Engineering、Materials Science、Chemistry、Energy Engineering、Environmental Science、Nuclear Engineering。',
  source: 'csca-reference-screenshot',
  sourceId: 'xian-jiaotong-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');
const deadlineNames = new Set([
  'Materials Science and Engineering',
  'Materials Science and Engineering (English)',
  'Electrical Engineering and Automation',
  'Electrical Engineering and Automation (English)',
  'Energy Internet Engineering'
]);

const basePrograms = [
  ['Materials Science and Engineering (English)', 'Materials Science and Engineering (English)', 'Materials Science', '英文授课', ['数学', '物理'], 80000, '¥80,000/年', 1],
  ['Electrical Engineering and Automation (English)', 'Electrical Engineering and Automation (English)', 'Electrical Engineering', '英文授课', ['数学', '物理'], 80000, '¥80,000/年', 2],
  ['Intelligent Manufacturing Engineering (English)', 'Intelligent Manufacturing Engineering (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 80000, '¥80,000/年', 3],
  ['Energy and Power Engineering (English)', 'Energy and Power Engineering (English)', 'Energy Engineering', '英文授课', ['数学', '物理'], 80000, '¥80,000/年', 4],
  ['Clinical Medicine MBBS (English)', 'Clinical Medicine MBBS (English)', 'Medicine', '英文授课', ['数学', '化学'], 180000, '¥180,000/年', 5],
  ['Materials Science and Engineering', 'Materials Science and Engineering', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 6],
  ['Electrical Engineering and Automation', 'Electrical Engineering and Automation', 'Electrical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 7],
  ['Energy Internet Engineering', 'Energy Internet Engineering', 'Energy Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 8],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 9],
  ['Electronic Science and Technology', 'Electronic Science and Technology', 'Electronic Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 10],
  ['Software Engineering', 'Software Engineering', 'Software Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 11],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', 12],
  ['Public Administration', 'Public Administration', 'Public Administration', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', 13],
  ['Big Data Management and Application', 'Big Data Management and Application', 'Management', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', 14],
  ['Business Administration', 'Business Administration', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', 15]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: nameZh.includes('MBBS') ? '6' : '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课项目按英语成绩要求确认。' : '中文授课项目按截图 HSK 政策确认。',
  englishRequirement: teachingLanguage === '英文授课' ? '按英文授课项目要求确认。' : undefined,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: '有奖学金',
  deadlineDate: deadlineNames.has(nameZh) ? deadlineDate : undefined,
  deadlineLabel: deadlineNames.has(nameZh) ? 'Jun 30, 2026' : undefined,
  applicationRound: deadlineNames.has(nameZh) ? '2026 本科申请' : undefined,
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
    scope: '行政管理、哲学、社会学、汉语言文学、外语、艺术、新闻传播等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学；适用于法学、行政管理、哲学、社会学、汉语言文学、外语、艺术、新闻传播等方向。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '电气、机械、计算机、能源、仪器类、材料化学、生物、化工类、护理学等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理（电气、机械、计算机、能源、仪器类）；理科中文 + 数学 + 化学（材料化学、生物、化工类）；护理学按理科中文 + 数学准备。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言相关专业及英文授课项目',
    cscaSubjects: [],
    languageCondition: '汉语言（商务方向）、汉语言文学专业 HSK4 级 180 分以上可免考文科中文；英文授课项目按英语成绩要求确认。',
    description: '汉语言（商务方向）、汉语言文学专业 HSK4 级 180 分以上可免考文科中文；英文授课项目按截图政策确认。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: 'C9 联盟成员；985；211 双一流；中国大学排名第 10；5 个英文授课本科；英文工程类学费较高。',
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
    name: '西安交通大学-西安市政府 “一带一路” 外国留学生奖学金',
    type: 'municipal',
    coverage: '部分资助',
    applicableDegree: '本科',
    applicableProgram: '西安交通大学国际学生项目',
    amountText: '以奖学金说明为准。',
    requirementText: '市级奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 1
  },
  {
    name: '西安交通大学中国政府奖学金（自主招生研究生）',
    type: 'government',
    coverage: '全额资助',
    applicableDegree: '研究生',
    applicableProgram: '研究生项目',
    amountText: '全额资助。',
    requirementText: '政府奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 2
  },
  {
    name: '西安交通大学发展中国家学生奖学金',
    type: 'university',
    coverage: '以奖学金说明为准',
    applicableDegree: '本科',
    applicableProgram: '国际学生项目',
    amountText: '以学校当年通知为准。',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 3
  }
].map((scholarship) => ({
  ...scholarship,
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
    scholarships,
    log: { note: '截图显示共 49 个可选专业；本脚本录入截图可见 15 个专业、截止日期摘要和 3 项奖学金。' }
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
