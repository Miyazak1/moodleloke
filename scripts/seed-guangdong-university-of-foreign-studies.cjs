const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '广东外语外贸大学',
  nameEn: 'Guangdong University of Foreign Studies',
  schoolType: 'regular',
  region: 'Guangzhou, South China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '英文授课免专业中文；汉语言专业 HSK4 可免专业中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：专业中文 + 数学；理工科类：数学 + 物理或化学。',
  cscaRequirementNote: '数学、物理、化学可选中英文。',
  undergradRequirements: '截图显示广东外语外贸大学本科项目包含英文授课和中文授课；英文授课可免专业中文，理工科类按数学、物理或化学判断。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按授课语言确认是否免专业中文；数学、物理、化学可选中英文版本。',
  tuitionSummary: '¥20,000 - ¥33,800/年。',
  tuitionByCategory: {
    chinesePrograms: '¥20,000/年',
    englishPrograms: '¥33,800/年',
    livingCost: '约 ¥2,200/月',
    display: {
      city: 'Guangzhou',
      regionLabel: 'South China',
      livingCostLabel: '~¥2,200/月',
      displayProgramCount: 3,
      displayUndergraduateCount: 3,
      visibleProgramCount: 3,
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 1 },
        { key: 'chinese_program', label: '汉语授课专业', total: 2, visibleCount: 2 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-30',
          label: '本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 Business Administration、International Business、International Economics and Trade 项目截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'Economics',
        'Management',
        'Law',
        'Literature',
        'Journalism',
        'Medicine',
        'Engineering',
        'Science',
        'Art'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,200/月。',
  scholarships: [],
  englishPrograms: 'International Business。',
  notablePrograms: 'International Business、Business Administration、International Economics and Trade。',
  programFields: 'Business Administration、Economics、Management、Law、Literature、Journalism、Medicine、Engineering、Science、Art。',
  source: 'csca-reference-screenshot',
  sourceId: 'guangdong-university-of-foreign-studies',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');

const basePrograms = [
  ['International Business', 'International Business', 'Business Administration', '英文授课', ['数学'], 33800, '¥33,800/年', '', 1],
  ['Business Administration', 'Business Administration', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', '有奖学金', 2],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', '', 3]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, scholarshipText, sortOrder]) => ({
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
  deadlineDate,
  deadlineLabel: 'Jun 30, 2026',
  applicationRound: '2026 本科申请',
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
    description: '专业中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工农医',
    cscaSubjects: ['数学', '物理', '化学'],
    description: '数学 + 物理或化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '英文授课与汉语言专业',
    cscaSubjects: [],
    languageCondition: '英文授课免专业中文；汉语言专业 HSK4 可免专业中文。',
    description: '符合条件的项目可免专业中文。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '考试语种',
    cscaSubjects: [],
    description: '数学、物理、化学可选中英文。',
    sortOrder: 4
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
    log: { note: '截图显示 3 个本科项目、4 条 CSCA 规则；Business Administration 项目标记有奖学金。' }
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
