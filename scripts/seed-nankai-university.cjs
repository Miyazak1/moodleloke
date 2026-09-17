const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '南开大学',
  nameEn: 'Nankai University',
  rank: 20,
  schoolType: 'regular',
  region: 'Tianjin, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '汉语言文化学院（汉语国际教育、汉语言经贸方向）持 HSK4 级可免中文科目。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：中文（文科）、理科中文 + 数学；汉语言文化学院仅需数学；理工科类按理学/工学、化学、医学、药学、生命科学分别匹配科目。',
  cscaRequirementNote: '985；211 双一流高校；分院系要求不同；数学、化学、历史学科全国顶尖。',
  undergradRequirements: '截图显示南开大学本科项目均为中文授课，按院系和专业方向匹配中文、数学、物理、化学等 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '部分项目截止：2026 年 5 月 31 日。',
  round1CloseDate: '2026-05-31',
  applicationSteps: '先确认目标院系；汉语言文化学院相关方向可按 HSK4 免中文科目，其他方向按院系分类准备 CSCA。',
  tuitionSummary: '¥20,000 - ¥35,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥20,000 - ¥35,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: 'Tianjin',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 41,
      displayUndergraduateCount: 41,
      visibleProgramCount: 10,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 41, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-31',
          label: '部分项目截止',
          dateLabel: 'May 31, 2026',
          endDate: '2026-05-31',
          description: '截图显示 Teaching Chinese to Speakers of Other Languages、Chinese Language and Business、Economics、International Economics and Trade、Finance 等项目截止日期为 2026 年 5 月 31 日。'
        }
      ],
      programFieldTags: [
        'Chinese Language',
        'Economics',
        'Finance',
        'Management',
        'Law',
        'Literature',
        'History',
        'Philosophy',
        'Mathematics',
        'Physics'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: ['南开大学奖学金'],
  englishPrograms: null,
  notablePrograms: 'Teaching Chinese to Speakers of Other Languages、Chinese Language and Business、Economics、International Economics and Trade、Finance、Insurance、Financial Engineering、Business Administration、Accounting、Marketing。',
  programFields: 'Chinese Language、Economics、Finance、Management、Law、Literature、History、Philosophy、Mathematics、Physics。',
  source: 'csca-reference-screenshot',
  sourceId: 'nankai-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-31T00:00:00.000Z');
const deadlineProgramNames = new Set([
  'Teaching Chinese to Speakers of Other Languages',
  'Chinese Language and Business',
  'Economics',
  'International Economics and Trade',
  'Finance'
]);

const basePrograms = [
  ['Teaching Chinese to Speakers of Other Languages', 'Teaching Chinese to Speakers of Other Languages', 'Chinese Language', ['中文(文科)', '数学'], 20000, '¥20,000/年', 1],
  ['Chinese Language and Business', 'Chinese Language and Business', 'Chinese Language', ['中文(文科)', '数学'], 20000, '¥20,000/年', 2],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 20000, '¥20,000/年', 3],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', ['中文(文科)', '数学'], 20000, '¥20,000/年', 4],
  ['Finance', 'Finance', 'Finance', ['中文(文科)', '数学'], 20000, '¥20,000/年', 5],
  ['Insurance', 'Insurance', 'Finance', ['中文(文科)', '数学'], 20000, '¥20,000/年', 6],
  ['Financial Engineering', 'Financial Engineering', 'Finance', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 7],
  ['Business Administration', 'Business Administration', 'Management', ['中文(文科)', '数学'], 20000, '¥20,000/年', 8],
  ['Accounting', 'Accounting', 'Management', ['中文(文科)', '数学'], 20000, '¥20,000/年', 9],
  ['Marketing', 'Marketing', 'Management', ['中文(文科)', '数学'], 20000, '¥20,000/年', 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
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
  deadlineDate: deadlineProgramNames.has(nameZh) ? deadlineDate : null,
  deadlineLabel: deadlineProgramNames.has(nameZh) ? 'May 31, 2026' : null,
  applicationRound: '2026 本科申请',
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
    scope: '文科、汉语言文化学院',
    cscaSubjects: ['中文(文科)', '中文(理科)', '数学'],
    description: '中文（文科）；理科中文 + 数学；汉语言文化学院仅需数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理学、工学、化学、医学、药学、生命科学',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理（理学、工学）；理科中文 + 数学 + 物理 + 化学（化学、医学、药学、生命科学）。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言文化学院',
    cscaSubjects: [],
    languageCondition: '汉语言文化学院（汉语国际教育、汉语言经贸方向）持 HSK4 级可免中文科目。',
    description: '汉语言文化学院（汉语国际教育、汉语言经贸方向）持 HSK4 级可免中文科目。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '985；211 双一流高校；分院系要求不同；数学、化学、历史学科全国顶尖。',
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
    name: '南开大学奖学金',
    type: 'university',
    coverage: '大学奖学金',
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
    log: { note: '截图显示 41 个本科项目，录入 10 个可见项目、4 条 CSCA 规则和 1 项奖学金。' }
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
