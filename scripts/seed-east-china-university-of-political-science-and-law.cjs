const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '华东政法大学',
  nameEn: 'East China University of Political Science and Law',
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '英文授课免文科中文；汉语言专业 HSK4 可免文科中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学。',
  cscaRequirementNote: '数学可选语言版本。',
  undergradRequirements: '截图显示华东政法大学本科项目以法学、经济、管理、政治学方向为主；中文授课项目需文科中文 + 数学，英文授课项目可免文科中文。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '中文授课本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按授课语言确认是否免文科中文；数学可选语言版本。',
  tuitionSummary: '¥24,000 - ¥30,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥24,000/年',
    englishPrograms: '¥30,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 6,
      displayUndergraduateCount: 6,
      visibleProgramCount: 6,
      displaySubjectTags: ['数学', '中文(文科)'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 1 },
        { key: 'chinese_program', label: '汉语授课专业', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-30',
          label: '中文授课本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 Accounting、Business Administration、Economics、Law、Political Science 等中文授课项目截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Accounting',
        'Business Administration',
        'Economics',
        'Law',
        'Political Science'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [],
  englishPrograms: 'Law(Specialized in International Business Law)。',
  notablePrograms: 'Law(Specialized in International Business Law)、Accounting、Business Administration、Economics、Law、Political Science。',
  programFields: 'Accounting、Business Administration、Economics、Law、Political Science。',
  source: 'csca-reference-screenshot',
  sourceId: 'east-china-university-of-political-science-and-law',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');

const basePrograms = [
  ['Law(Specialized in International Business Law)', 'Law(Specialized in International Business Law)', 'Law', '英文授课', ['数学'], 30000, '¥30,000/年', undefined, undefined, '有奖学金', 1],
  ['Accounting', 'Accounting', 'Accounting', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', deadlineDate, 'Jun 30, 2026', '', 2],
  ['Business Administration', 'Business Administration', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', deadlineDate, 'Jun 30, 2026', '', 3],
  ['Economics', 'Economics', 'Economics', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', deadlineDate, 'Jun 30, 2026', '', 4],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', deadlineDate, 'Jun 30, 2026', '', 5],
  ['Political Science', 'Political Science', 'Political Science', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', deadlineDate, 'Jun 30, 2026', '', 6]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, deadlineDateValue, deadlineLabel, scholarshipText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: scholarshipText || undefined,
  deadlineDate: deadlineDateValue,
  deadlineLabel,
  applicationRound: deadlineDateValue ? '2026 本科申请' : undefined,
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
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '英文授课与汉语言专业',
    cscaSubjects: [],
    languageCondition: '英文授课免文科中文；汉语言专业 HSK4 可免文科中文。',
    description: '符合条件的项目可免文科中文。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '数学语种',
    cscaSubjects: [],
    description: '数学可选语言版本。',
    sortOrder: 3
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
    log: { note: '截图显示 6 个本科项目、3 条 CSCA 规则；英文法学项目带项目奖学金标记。' }
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
