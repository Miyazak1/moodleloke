const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '广西医科大学',
  nameEn: 'Guangxi Medical University',
  schoolType: 'regular',
  region: 'Nanning, South China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '理工科类：数学 + 化学必考；MBBS 英文授课无需中文；其他专业需理科中文。',
  cscaRequirementNote: 'MBBS 选英文试卷。',
  undergradRequirements: '截图显示广西医科大学本科项目按医学类理工科要求判断，英文 MBBS 需数学与化学，中文授课医学类需理科中文并按项目匹配数学/化学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 8 月 15 日。',
  round1CloseDate: '2026-08-15',
  applicationSteps: 'MBBS 英文授课无需中文，其他中文授课专业需理科中文；医学相关专业重点准备数学与化学。',
  tuitionSummary: '¥28,000 - ¥35,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥28,000/年',
    englishPrograms: '¥35,000/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Nanning',
      regionLabel: 'South China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 6,
      displayUndergraduateCount: 6,
      visibleProgramCount: 6,
      displaySubjectTags: ['中文(理科)', '数学', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 1, visibleCount: 1 },
        { key: 'chinese_program', label: '汉语授课专业', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-08-15',
          label: '本科项目截止',
          dateLabel: 'Aug 15, 2026',
          endDate: '2026-08-15',
          description: '截图显示 Biomedical Engineering、Nursing、Pharmacology、Public Affairs Administration、Stomatology 等中文授课项目截止日期为 2026 年 8 月 15 日。'
        }
      ],
      programFieldTags: [
        'Biology',
        'Dentistry',
        'Economics',
        'MBBS',
        'Nursing',
        'Pharmacy'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: [],
  englishPrograms: 'MBBS。',
  notablePrograms: 'MBBS、Biomedical Engineering、Nursing、Pharmacology、Public Affairs Administration(Direction of Public Health Management)、Stomatology。截图展示 6 个本科项目。',
  programFields: 'Biology、Dentistry、Economics、MBBS、Nursing、Pharmacy。',
  source: 'csca-reference-screenshot',
  sourceId: 'guangxi-medical-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-08-15T00:00:00.000Z');

const basePrograms = [
  ['MBBS', 'MBBS', 'MBBS', '英文授课', ['数学', '化学'], 35000, '¥35,000/年', '6', 1],
  ['Biomedical Engineering', 'Biomedical Engineering', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 28000, '¥28,000/年', '4', 2],
  ['Nursing', 'Nursing', 'Nursing', '中文授课', ['中文(理科)', '数学', '化学'], 28000, '¥28,000/年', '4', 3],
  ['Pharmacology', 'Pharmacology', 'Pharmacy', '中文授课', ['中文(理科)', '数学'], 28000, '¥28,000/年', '5', 4],
  ['Public Affairs Administration(Direction of Public Health Management)', 'Public Affairs Administration(Direction of Public Health Management)', 'Economics', '中文授课', ['中文(文科)', '数学'], 28000, '¥28,000/年', '4', 5],
  ['Stomatology', 'Stomatology', 'Dentistry', '中文授课', ['中文(理科)', '数学', '化学'], 28000, '¥28,000/年', '5', 6]
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
  deadlineLabel: 'Aug 15, 2026',
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
    scope: '医学类专业',
    cscaSubjects: ['数学', '化学'],
    description: '数学 + 化学必考；MBBS 英文授课无需中文；其他专业需理科中文。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: 'MBBS 英文授课',
    cscaSubjects: [],
    description: 'MBBS 选英文试卷。',
    sortOrder: 2
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
    log: { note: '截图显示 6 个本科项目、1 个英文授课项目，中文 5 个，截止日期为 2026 年 8 月 15 日。' }
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
