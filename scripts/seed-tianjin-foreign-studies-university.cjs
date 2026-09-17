const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '天津外国语大学',
  nameEn: 'Tianjin Foreign Studies University',
  schoolType: 'regular',
  region: 'Tianjin, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '本科需 HSK 四级 180 分及以上；无免考政策。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学（中文）+ 物理。',
  cscaRequirementNote: '中国外语类专业最齐全的高校之一；全中文授课；留学生需校内住宿；汉语国际教育专业仅需数学。',
  undergradRequirements: '截图显示天津外国语大学本科项目均为中文授课；文科/人文类需文科中文与数学，理工科类需理科中文、中文数学与物理。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '部分项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '按中文授课项目准备 HSK 四级 180 分及以上；汉语国际教育专业按截图提示仅需数学。',
  tuitionSummary: '¥18,000 - ¥22,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000 - ¥22,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: 'Tianjin',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 30,
      displayUndergraduateCount: 30,
      visibleProgramCount: 10,
      hiddenProgramNote: '还有20个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 30, visibleCount: 10, hiddenNote: '还有20个汉语授课专业' }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-15',
          label: '部分项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: '截图显示 Teaching Chinese to Speakers of Other Languages、International Business (Cross-border E-commerce)、Translation (English)、Business English (English)、English (English) 等项目截止日期为 2026 年 6 月 15 日。'
        }
      ],
      programFieldTags: [
        'Law',
        'Political Science',
        'Foreign Languages',
        'Journalism',
        'Chinese Language',
        'Economics',
        'Education',
        'Art',
        'Engineering'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: ['天津外国语大学新生奖学金'],
  englishPrograms: null,
  notablePrograms: 'Law、International Politics、Diplomacy、International Organizations and Global Governance、Arabic、Korean、German、Russian、French、Portuguese。',
  programFields: 'Law、Political Science、Foreign Languages、Journalism、Chinese Language、Economics、Education、Art、Engineering。',
  source: 'csca-reference-screenshot',
  sourceId: 'tianjin-foreign-studies-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Law', 'Law', 'Law', ['中文(文科)', '数学'], 18000, '¥18,000/年', 1],
  ['International Politics', 'International Politics', 'Political Science', ['中文(文科)', '数学'], 18000, '¥18,000/年', 2],
  ['Diplomacy', 'Diplomacy', 'Political Science', ['中文(文科)', '数学'], 18000, '¥18,000/年', 3],
  ['International Organizations and Global Governance', 'International Organizations and Global Governance', 'Political Science', ['中文(文科)', '数学'], 18000, '¥18,000/年', 4],
  ['Arabic', 'Arabic', 'Foreign Languages', ['中文(文科)', '数学'], 20000, '¥20,000/年', 5],
  ['Korean', 'Korean', 'Foreign Languages', ['中文(文科)', '数学'], 20000, '¥20,000/年', 6],
  ['German', 'German', 'Foreign Languages', ['中文(文科)', '数学'], 20000, '¥20,000/年', 7],
  ['Russian', 'Russian', 'Foreign Languages', ['中文(文科)', '数学'], 20000, '¥20,000/年', 8],
  ['French', 'French', 'Foreign Languages', ['中文(文科)', '数学'], 20000, '¥20,000/年', 9],
  ['Portuguese', 'Portuguese', 'Foreign Languages', ['中文(文科)', '数学'], 20000, '¥20,000/年', 10]
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
    scope: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '中文授课',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学（中文）+ 物理。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '中文授课',
    cscaSubjects: [],
    languageCondition: '本科需 HSK 四级 180 分及以上；无免考政策。',
    description: '本科需 HSK 四级 180 分及以上；无免考政策。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '中国外语类专业最齐全的高校之一；全中文授课；留学生需校内住宿；汉语国际教育专业仅需数学。',
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
    name: '天津外国语大学新生奖学金',
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
    log: { note: '截图显示 30 个本科项目，录入 10 个可见项目、4 条 CSCA 规则和 1 项奖学金。' }
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
