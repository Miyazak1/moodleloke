const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '上海政法学院',
  nameEn: 'Shanghai University of Political Science and Law',
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '商务汉语和国际中文教育专业 HSK4 级 180 分以上可免考文科中文科目。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；英语授课专业：数学。',
  cscaRequirementNote: '以法学和政治学为特色的专业型大学；中文授课项目必须选择 CSCA 中文语种试卷。',
  undergradRequirements: '截图显示上海政法学院本科项目按中文授课文科/人文类和英语授课专业分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '中文授课项目选择 CSCA 中文语种试卷；英文授课项目按数学科目准备。',
  tuitionSummary: '¥21,500 - ¥32,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥21,500 - ¥23,000/年',
    englishPrograms: '¥32,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 9,
      displayUndergraduateCount: 9,
      visibleProgramCount: 9,
      displaySubjectTags: ['中文(文科)', '数学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 3, visibleCount: 3 },
        { key: 'chinese_program', label: '汉语授课专业', total: 6, visibleCount: 6 },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Law - International Law、International Politics、Economics and Finance、International Economy and Trade、Teaching Chinese to Speakers of Other Languages 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Law',
        'Political Science',
        'Economics',
        'International Trade',
        'Chinese Language'
      ],
      cscScholarship: {
        title: '中国政府奖学金 (CSC)',
        label: '全额资助',
        description: '中国规模最大的来华留学生奖学金资助项目，由国家留学基金委管理。'
      }
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [
    '上海政法学院 “一带一路” 奖学金',
    '上海政法学院上海市政府奖学金',
    '上海政法学院中国政府奖学金'
  ],
  englishPrograms: 'International Politics (English)、International Economy and Trade (English)、Electronic Commerce and Law (English)。',
  notablePrograms: 'International Politics (English)、International Economy and Trade (English)、Electronic Commerce and Law (English)、Law - International Law、International Politics、Economics and Finance、International Economy and Trade、Teaching Chinese to Speakers of Other Languages、Business Chinese。',
  programFields: 'Law、Political Science、Economics、International Trade、Chinese Language。',
  source: 'csca-reference-screenshot',
  sourceId: 'shanghai-university-of-political-science-and-law',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');
const deadlineNames = new Set([
  'Law - International Law',
  'International Politics',
  'Economics and Finance',
  'International Economy and Trade',
  'Teaching Chinese to Speakers of Other Languages'
]);

const basePrograms = [
  ['International Politics (English)', 'International Politics (English)', 'Political Science', '英文授课', ['数学'], 32000, '¥32,000/年', 1],
  ['International Economy and Trade (English)', 'International Economy and Trade (English)', 'International Trade', '英文授课', ['数学'], 32000, '¥32,000/年', 2],
  ['Electronic Commerce and Law (English)', 'Electronic Commerce and Law (English)', 'Law', '英文授课', ['数学', '物理'], 32000, '¥32,000/年', 3],
  ['Law - International Law', 'Law - International Law', 'Law', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', 4],
  ['International Politics', 'International Politics', 'Political Science', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', 5],
  ['Economics and Finance', 'Economics and Finance', 'Economics', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', 6],
  ['International Economy and Trade', 'International Economy and Trade', 'International Trade', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', 7],
  ['Teaching Chinese to Speakers of Other Languages', 'Teaching Chinese to Speakers of Other Languages', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 21500, '¥21,500/年', 8],
  ['Business Chinese', 'Business Chinese', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 21500, '¥21,500/年', 9]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课专业按项目语言要求确认。' : '中文授课项目按截图 HSK 政策确认。',
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
    scope: '中文授课文科/人文类专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学；考试语言为中文。',
    sortOrder: 1
  },
  {
    title: '英语授课专业',
    category: 'english_program',
    scope: '英语授课本科项目',
    cscaSubjects: ['数学'],
    description: '英语授课专业准备数学，考试语言为英文。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '商务汉语和国际中文教育专业',
    cscaSubjects: [],
    languageCondition: '商务汉语和国际中文教育专业 HSK4 级 180 分以上可免考文科中文科目。',
    description: '达到截图显示的 HSK 条件可按免考政策处理。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '以法学和政治学为特色的专业型大学；中文授课项目必须选择 CSCA 中文语种试卷。',
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
    name: '上海政法学院 “一带一路” 奖学金',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '本科',
    applicableProgram: '上海政法学院国际学生项目',
    amountText: '以学校当年通知为准。',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 1
  },
  {
    name: '上海政法学院上海市政府奖学金',
    type: 'municipal',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '上海政法学院国际学生项目',
    amountText: '全额资助。',
    requirementText: '政府奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 2
  },
  {
    name: '上海政法学院中国政府奖学金',
    type: 'government',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '上海政法学院国际学生项目',
    amountText: '全额资助。',
    requirementText: '政府奖学金，具体申请条件以学校当年说明为准。',
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
    log: { note: '截图显示 9 个本科专业、4 条 CSCA 规则、5 个截止日期项目、3 项奖学金。' }
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
