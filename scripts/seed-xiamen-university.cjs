const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '厦门大学',
  nameEn: 'Xiamen University',
  schoolType: 'regular',
  region: 'Xiamen, Southeast China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '人文社科经管法艺术类需 HSK5 级 210 分；理工医体育类需 HSK4 级 210 分；汉语言专业 HSK4 可免中文科目。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理或化学。',
  cscaRequirementNote: '985；211 双一流；华侨创办第一所大学；全球最美校园之一；化学、海洋科学、生物、生态、统计、教育为世界一流学科。',
  undergradRequirements: '截图显示厦门大学本科项目按人文社科、经济法、艺术类、理工农医类分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  applicationSteps: '先确认目标专业所属学科类别、授课语言和 HSK 条件；英文授课专业按项目语言要求准备。',
  tuitionSummary: '¥24,000 - ¥90,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥24,000 - ¥26,000/年',
    englishPrograms: '¥38,000 - ¥90,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: 'Xiamen',
      regionLabel: 'Southeast China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 35,
      displayUndergraduateCount: 35,
      visibleProgramCount: 14,
      hiddenProgramNote: '还有21个汉语授课专业',
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 4, visibleCount: 4 },
        { key: 'chinese_program', label: '汉语授课专业', total: 31, visibleCount: 10, hiddenNote: '还有21个汉语授课专业' }
      ],
      programFieldTags: [
        'Chemistry',
        'Marine Science',
        'Biology',
        'Ecology',
        'Statistics',
        'Education',
        'Economics',
        'Management',
        'Law',
        'Literature',
        '+5个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: [
    '厦门大学 “国际学生新生奖学金”',
    '厦门大学福建省政府外国留学生奖学金',
    '厦门大学陈嘉庚奖学金'
  ],
  englishPrograms: 'Clinical Medicine MBBS (English)、Visual Communication Design (English)、Environmental Design (English)、Digital Media Art (English)。',
  notablePrograms: 'Clinical Medicine MBBS (English)、Visual Communication Design (English)、Environmental Design (English)、Digital Media Art (English)、Chemistry、Marine Science、Biological Science、Ecology、Statistics、Education、Economics、Finance、International Economics and Trade、Accounting。',
  programFields: 'Chemistry、Marine Science、Biology、Ecology、Statistics、Education、Economics、Management、Law、Literature。',
  source: 'csca-reference-screenshot',
  sourceId: 'xiamen-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Clinical Medicine MBBS (English)', 'Clinical Medicine MBBS (English)', 'Medicine', '英文授课', ['数学', '化学'], 38000, '¥38,000/年', '6', 1],
  ['Visual Communication Design (English)', 'Visual Communication Design (English)', 'Art and Design', '英文授课', ['数学', '物理'], 90000, '¥90,000/年', '4', 2],
  ['Environmental Design (English)', 'Environmental Design (English)', 'Art and Design', '英文授课', ['数学'], 90000, '¥90,000/年', '4', 3],
  ['Digital Media Art (English)', 'Digital Media Art (English)', 'Art and Design', '英文授课', ['数学'], 90000, '¥90,000/年', '4', 4],
  ['Chemistry', 'Chemistry', 'Chemistry', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 26000, '¥26,000/年', '4', 5],
  ['Marine Science', 'Marine Science', 'Marine Science', '中文授课', ['中文(理科)', '数学'], 26000, '¥26,000/年', '4', 6],
  ['Biological Science', 'Biological Science', 'Biology', '中文授课', ['中文(理科)', '数学'], 26000, '¥26,000/年', '4', 7],
  ['Ecology', 'Ecology', 'Ecology', '中文授课', ['中文(理科)', '数学'], 26000, '¥26,000/年', '4', 8],
  ['Statistics', 'Statistics', 'Statistics', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 9],
  ['Education', 'Education', 'Education', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', '4', 10],
  ['Economics', 'Economics', 'Economics', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 11],
  ['Finance', 'Finance', 'Economics', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 12],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 13],
  ['Accounting', 'Accounting', 'Management', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 14]
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
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课项目按项目语言要求确认。' : '按专业类别确认 HSK4/HSK5 要求。',
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
    title: '文科/人文类',
    category: 'humanities',
    scope: '人文社科、经济法、艺术类、汉语言专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学（人文社科、经济法、艺术类）；汉语言专业持 HSK4 可免考中文科目。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工农医类',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理或化学；适用于医学、理工农医类等方向。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '人文社科经管法艺术类、理工医体育类、汉语言专业',
    cscaSubjects: [],
    languageCondition: '人文社科经管法艺术类需 HSK5 级 210 分；理工医体育类需 HSK4 级 210 分；汉语言专业 HSK4 可免中文科目。',
    description: '按截图显示的 HSK 等级和分数判断免考政策。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '985；211 双一流；华侨创办第一所大学；全球最美校园之一；化学、海洋科学、生物、生态、统计、教育为世界一流学科。',
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
    name: '厦门大学 “国际学生新生奖学金”',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '本科',
    applicableProgram: '厦门大学国际学生项目',
    amountText: '以学校当年通知为准。',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 1
  },
  {
    name: '厦门大学福建省政府外国留学生奖学金',
    type: 'provincial',
    coverage: '省级奖学金',
    applicableDegree: '本科',
    applicableProgram: '厦门大学国际学生项目',
    amountText: '以奖学金说明为准。',
    requirementText: '省级奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 2
  },
  {
    name: '厦门大学陈嘉庚奖学金',
    type: 'university',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '厦门大学国际学生项目',
    amountText: '全额资助。',
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
    log: { note: '截图显示共 35 个本科专业；本脚本录入截图可见 14 个专业和 3 项奖学金。' }
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
