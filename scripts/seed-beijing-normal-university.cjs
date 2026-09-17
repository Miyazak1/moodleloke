const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京师范大学',
  nameEn: 'Beijing Normal University',
  rank: 35,
  schoolType: 'regular',
  region: 'Beijing, North China China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '汉语言国际教育专业需 HSK 四级 180 分；其他专业需 HSK 五级（180 分）。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理；化学具体科目详见专业目录。',
  cscaRequirementNote: '985；211 双一流高校；北京校区和珠海校区；需参加学校组织的面试。',
  undergradRequirements: '截图显示北京师范大学本科项目均为中文授课；文科/人文类需文科中文与数学，理工科类需理科中文、数学与物理，化学科目按专业目录确认。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: null,
  round1CloseDate: null,
  applicationSteps: '按专业类别确认文科中文或理科中文；汉语言国际教育专业需 HSK 四级 180 分，其他专业需 HSK 五级 180 分。',
  tuitionSummary: '¥24,000 - ¥27,700/年。',
  tuitionByCategory: {
    chinesePrograms: '¥24,000 - ¥27,700/年',
    livingCost: '约 ¥4,000/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China China',
      livingCostLabel: '~¥4,000/月',
      displayProgramCount: 20,
      displayUndergraduateCount: 40,
      visibleProgramCount: 10,
      hiddenProgramNote: '还有10个汉授课专业',
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 20, visibleCount: 10 }
      ],
      programFieldTags: [
        'Education',
        'Chinese Language',
        'Psychology',
        'Literature',
        'History',
        'Philosophy',
        'Economics',
        'Law',
        'Sciences',
        'Geography'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥4,000/月。',
  scholarships: [],
  englishPrograms: null,
  notablePrograms: 'Chinese Language、Teaching Chinese to Speakers of Other Languages、Education、Psychology、Chinese Language and Literature、History、Philosophy、Economics、Law、Mathematics and Applied Mathematics。',
  programFields: 'Education、Chinese Language、Psychology、Literature、History、Philosophy、Economics、Law、Sciences、Geography。',
  source: 'csca-reference-screenshot',
  sourceId: 'beijing-normal-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Chinese Language', 'Chinese Language', 'Chinese Language', ['中文(文科)', '数学'], 24000, '¥24,000/年', 1],
  ['Teaching Chinese to Speakers of Other Languages', 'Teaching Chinese to Speakers of Other Languages', 'Chinese Language', ['中文(文科)', '数学'], 24000, '¥24,000/年', 2],
  ['Education', 'Education', 'Education', ['中文(文科)', '数学'], 24000, '¥24,000/年', 3],
  ['Psychology', 'Psychology', 'Psychology', ['中文(理科)', '数学', '物理'], 27700, '¥27,700/年', 4],
  ['Chinese Language and Literature', 'Chinese Language and Literature', 'Literature', ['中文(文科)', '数学'], 24000, '¥24,000/年', 5],
  ['History', 'History', 'History', ['中文(文科)', '数学'], 24000, '¥24,000/年', 6],
  ['Philosophy', 'Philosophy', 'Philosophy', ['中文(文科)', '数学'], 24000, '¥24,000/年', 7],
  ['Economics', 'Economics', 'Economics', ['中文(文科)', '数学'], 24000, '¥24,000/年', 8],
  ['Law', 'Law', 'Law', ['中文(文科)', '数学'], 24000, '¥24,000/年', 9],
  ['Mathematics and Applied Mathematics', 'Mathematics and Applied Mathematics', 'Sciences', ['中文(理科)', '数学', '物理'], 27700, '¥27,700/年', 10]
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
    scope: '教育、中文、文学、历史、哲学、经济、法学等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '心理学、数学与应用数学等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学 + 物理。',
    sortOrder: 2
  },
  {
    title: '化学',
    category: 'science',
    scope: '具体科目以专业目录为准',
    cscaSubjects: ['化学'],
    description: '具体科目详见专业目录。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言及其他专业',
    cscaSubjects: [],
    languageCondition: '汉语言国际教育专业需 HSK 四级 180 分；其他专业需 HSK 五级（180 分）。',
    description: '汉语言国际教育专业需 HSK 四级 180 分；其他专业需 HSK 五级（180 分）。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '院校层级与面试提示',
    cscaSubjects: [],
    description: '985；211 双一流高校；北京校区和珠海校区；需参加学校组织的面试。',
    sortOrder: 5
  }
].map((rule) => ({
  ...rule,
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
    scholarships: [],
    log: { note: '截图显示 20 个可选专业，统计卡显示 40 个本科；录入 10 个可见项目、5 条 CSCA 规则。' }
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
