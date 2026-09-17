const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/jilin-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '吉林大学',
  nameEn: 'Jilin University',
  rank: 23,
  schoolType: 'regular',
  region: 'Changchun, Northeast China',
  officialWebsite: 'https://www.jlu.edu.cn/',
  applicationSystemUrl: 'http://apply.jlu.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 可免专业中文；未通过需读预科。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文，或理科中文（按专业类别选择）+ 数学；理工科类：数学 + 物理或化学。',
  cscaRequirementNote: '数学必考。',
  undergradRequirements: '截图参考页显示吉林大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 7 月 15 日。',
  round1CloseDate: '2026-07-15',
  applicationSteps: '先按授课语言和专业方向确认中文科目；数学为必考。',
  tuitionSummary: '¥19,000 - ¥33,000/年。',
  tuitionByCategory: {
    humanities: '¥19,000 - ¥20,000/年',
    mbbs: '¥33,000/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Changchun',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 3,
      displayUndergraduateCount: 3,
      visibleProgramCount: 3,
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)', '中文(理科)'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 },
        { key: 'chinese_program', label: '汉语授课专业', total: 1, visibleCount: 1 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jul 15, 2026',
          endDate: '2026-07-15',
          description: 'International Economics and Trade、Law、MBBS 三个项目显示该截止日期。'
        }
      ],
      programFieldTags: ['Economics', 'Law', 'MBBS']
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: ['吉林大学“金豆”国际学生奖（助）学金'],
  englishPrograms: 'Law、MBBS。',
  notablePrograms: 'Law、MBBS、International Economics and Trade。',
  programFields: 'Economics、Law、MBBS。',
  source: 'csca-reference-screenshot',
  sourceId: 'jilin-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Law', 'Law', 'Law', '英文授课', ['数学'], 20000, '¥20,000/年', '4', 1],
  ['MBBS', 'MBBS', 'MBBS', '英文授课', ['数学', '化学'], 33000, '¥33,000/年', '6', 2],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 3]
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
  deadlineDate: new Date('2026-07-15T00:00:00.000Z'),
  deadlineLabel: 'Jul 15, 2026',
  applicationRound: '2026 本科申请',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '文科方向及部分理科中文项目',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文；理科中文（按专业类别选择）+ 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工农医类',
    cscaSubjects: ['数学', '物理', '化学'],
    description: '数学 + 物理或化学。理工农医方向适用。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '专业中文',
    cscaSubjects: [],
    languageCondition: 'HSK4 可免专业中文；未通过需读预科。',
    description: '达到 HSK4 条件可免专业中文，未通过需读预科。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '数学',
    cscaSubjects: [],
    description: '数学必考。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '吉林大学“金豆”国际学生奖（助）学金',
  type: 'other',
  applicableDegree: '本科',
  applicableProgram: '吉林大学国际学生本科项目',
  requirementText: '其他奖学金，具体申请条件以学校当年通知为准。',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
}];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示共 3 个本科专业；本脚本录入截图可见全部专业、截止日期与奖学金。' }
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
