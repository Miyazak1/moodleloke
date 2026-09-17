const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '中国医科大学',
  nameEn: 'China Medical University',
  schoolType: 'regular',
  region: 'Shenyang, Northeast China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '医学类专业：中文授课需理科中文 + 数学 + 化学；英文授课需数学 + 化学。',
  cscaRequirementNote: '医学类专业。',
  undergradRequirements: '截图显示中国医科大学本科项目以医学类理工科要求为主，中文授课项目需理科中文、数学、化学，英文授课项目需数学、化学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 8 月 31 日。',
  round1CloseDate: '2026-08-31',
  applicationSteps: '按授课语言确认是否需要中文(理科)；医学类项目重点准备数学与化学。',
  tuitionSummary: '¥32,000 - ¥40,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥32,000/年',
    englishPrograms: '¥40,000/年',
    livingCost: '约 ¥1,300/月',
    display: {
      city: 'Shenyang',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,300/月',
      displayProgramCount: 4,
      displayUndergraduateCount: 4,
      visibleProgramCount: 4,
      displaySubjectTags: ['中文(理科)', '数学', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 },
        { key: 'chinese_program', label: '汉语授课专业', total: 2, visibleCount: 2 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-08-31',
          label: '本科项目截止',
          dateLabel: 'Aug 31, 2026',
          endDate: '2026-08-31',
          description: '截图显示 Clinical Medicine、MBBS in English、Stomatology 等项目截止日期为 2026 年 8 月 31 日。'
        }
      ],
      programFieldTags: [
        'Dentistry',
        'MBBS',
        'Accounting',
        'Business Administration',
        'Chemistry',
        'Economics',
        'Law',
        'Mathematics',
        'Pharmacy',
        'Physics'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,300/月。',
  scholarships: [],
  englishPrograms: 'MBBS in English、Stomatology。',
  notablePrograms: 'MBBS in English、Stomatology、Clinical Medicine。截图展示 4 个医学类本科项目。',
  programFields: 'Dentistry、MBBS、Chemistry、Pharmacy、Physics。',
  source: 'csca-reference-screenshot',
  sourceId: 'china-medical-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-08-31T00:00:00.000Z');

const basePrograms = [
  ['MBBS in English', 'MBBS in English', 'MBBS', '英文授课', ['数学', '化学'], 40000, '¥40,000/年', '6', 1],
  ['Stomatology', 'Stomatology', 'Dentistry', '英文授课', ['数学', '化学'], 40000, '¥40,000/年', '5', 2],
  ['Clinical Medicine', 'Clinical Medicine', 'Clinical Medicine', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 32000, '¥32,000/年', '5', 3],
  ['Stomatology', 'Stomatology', 'Dentistry', '中文授课', ['中文(理科)', '数学', '化学'], 32000, '¥32,000/年', '5', 4]
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
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  deadlineDate,
  deadlineLabel: 'Aug 31, 2026',
  applicationRound: '2026 本科申请',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '理工科类',
    category: 'science',
    scope: '医学类中文授课专业',
    cscaSubjects: ['中文(理科)', '数学', '化学'],
    description: '中文授课：理科中文 + 数学 + 化学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '医学类英文授课专业',
    cscaSubjects: ['数学', '化学'],
    description: '英文授课：数学 + 化学。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '医学类专业',
    cscaSubjects: [],
    description: '医学类专业。',
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
    log: { note: '截图显示 4 个本科项目、2 个英文授课项目，截止日期为 2026 年 8 月 31 日。' }
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
