const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '郑州大学',
  nameEn: 'Zhengzhou University',
  schoolType: 'regular',
  region: 'Zhengzhou, Central China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科', '硕士', '博士'],
  hskRequirement: '各科目 50 分或科目总分 60%。',
  cscaRequired: true,
  cscaRequirement: '文科/人文类：待定；理工科类：待定。以截图显示的项目 CSCA 科目为准。',
  cscaRequirementNote: '建议添加预科。',
  undergradRequirements: '截图显示郑州大学 CSCA 大类要求仍为待定，但项目卡片已给出中文/英文授课、数学、物理、化学等科目组合。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分英文授课项目截止：2026 年 6 月 15 日；部分中文授课项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先按目标项目卡片确认 CSCA 科目；若科目仍待定，建议补充预科或人工复核。',
  tuitionSummary: '¥18,000 - ¥35,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000 - ¥25,000/年',
    englishPrograms: '¥20,000 - ¥35,000/年',
    livingCost: '约 ¥1,300/月',
    display: {
      city: 'Zhengzhou',
      regionLabel: 'Central China',
      livingCostLabel: '~¥1,300/月',
      displayProgramCount: 28,
      displayUndergraduateCount: 20,
      displayPostgraduateCount: 6,
      visibleProgramCount: 15,
      displaySubjectTags: ['待确认'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 6, visibleCount: 6 },
        { key: 'chinese_program', label: '汉语授课专业', total: 22, visibleCount: 9, hiddenNote: '还有 13 个汉语授课专业' }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-15',
          label: 'International Trade 截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: '截图显示 International Trade 项目截止日期为 2026 年 6 月 15 日。'
        },
        {
          key: 'deadline-2026-06-30',
          label: '部分中文授课项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 Accounting、Applied Chemistry、Applied Physics、Architecture 等项目截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Accounting',
        'Architecture',
        'Biology',
        'Business Administration',
        'Chemistry',
        'Civil Engineering',
        'Dentistry',
        'Economics',
        'Law',
        'MBBS'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,300/月。',
  scholarships: [
    '郑州大学伦敦校区留学生奖学金',
    '郑州大学校长奖学金',
    '郑州大学河南省政府奖学金'
  ],
  englishPrograms: 'Civil Engineering、Dental Surgery、Finance、International Trade、MBBS in English (6 years)、Pharmacy。',
  notablePrograms: 'Civil Engineering、Dental Surgery、Finance、International Trade、MBBS in English (6 years)、Pharmacy、Accounting、Applied Chemistry、Applied Physics、Architecture、Business Administration、Chemistry、Economics。截图展示 28 个项目中的可见部分。',
  programFields: 'Accounting、Architecture、Biology、Business Administration、Chemistry、Civil Engineering、Dentistry、Economics、Law、MBBS。',
  source: 'csca-reference-screenshot',
  sourceId: 'zhengzhou-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const dateJun15 = new Date('2026-06-15T00:00:00.000Z');
const dateJun30 = new Date('2026-06-30T00:00:00.000Z');

const basePrograms = [
  ['Civil Engineering', 'Civil Engineering', '本科', '4', 'Civil Engineering', '英文授课', ['数学', '物理'], 25000, '¥25,000/年', dateJun30, 'Jun 30, 2026', '', 1],
  ['Dental Surgery', 'Dental Surgery', '本科', '6', 'Dentistry', '英文授课', ['数学', '化学'], 35000, '¥35,000/年', dateJun30, 'Jun 30, 2026', '', 2],
  ['Finance', 'Finance', '博士', '4', 'Economics', '英文授课', ['数学'], 35000, '¥35,000/年', dateJun30, 'Jun 30, 2026', '', 3],
  ['International Trade', 'International Trade', '硕士', '3', 'Economics', '英文授课', ['数学'], 30000, '¥30,000/年', dateJun15, 'Jun 15, 2026', '', 4],
  ['MBBS in English (6 years)', 'MBBS in English (6 years)', '本科', '6', 'MBBS', '英文授课', ['数学', '化学'], 35000, '¥35,000/年', dateJun30, 'Jun 30, 2026', '', 5],
  ['Pharmacy', 'Pharmacy', '本科', '4', 'Pharmacy', '英文授课', ['数学', '化学'], 25000, '¥25,000/年', dateJun30, 'Jun 30, 2026', '', 6],
  ['Accounting', 'Accounting', '本科', '4', 'Accounting', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', dateJun30, 'Jun 30, 2026', '', 7],
  ['Applied Chemistry', 'Applied Chemistry', '本科', '4', 'Chemistry', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', dateJun30, 'Jun 30, 2026', '', 8],
  ['Applied Physics', 'Applied Physics', '本科', '4', 'Physics', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', dateJun30, 'Jun 30, 2026', '', 9],
  ['Architecture', 'Architecture', '本科', '5', 'Architecture', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', dateJun30, 'Jun 30, 2026', '', 10],
  ['Business Administration', 'Business Administration', '本科', '4', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', dateJun30, 'Jun 30, 2026', '有奖学金', 11],
  ['Business Administration', 'Business Administration', '硕士', '3', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 25000, '¥25,000/年', dateJun30, 'Jun 30, 2026', '有奖学金', 12],
  ['Chemistry', 'Chemistry', '本科', '4', 'Chemistry', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 20000, '¥20,000/年', dateJun30, 'Jun 30, 2026', '', 13],
  ['Civil Engineering', 'Civil Engineering', '本科', '4', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', dateJun30, 'Jun 30, 2026', '', 14],
  ['Economics', 'Economics', '本科', '4', 'Economics', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', dateJun30, 'Jun 30, 2026', '', 15],
  ['Finance', 'Finance', '本科', '4', 'Economics', '中文授课', ['中文(文科)', '数学'], 20000, '¥20,000/年', dateJun30, 'Jun 30, 2026', '', 16]
];

const programs = basePrograms.map(([nameZh, nameEn, degreeLevel, durationYears, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, deadlineDate, deadlineLabel, scholarshipText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel,
  durationYears,
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
  deadlineLabel,
  applicationRound: '2026 申请季',
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
    scope: '待定',
    cscaSubjects: [],
    description: '待定。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '待定',
    cscaSubjects: [],
    description: '待定。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '免考成绩',
    cscaSubjects: [],
    languageCondition: '各科目 50 分或科目总分 60%。',
    description: '达到截图显示的分数条件可按免考政策处理。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '预科建议',
    cscaSubjects: [],
    description: '建议添加预科。',
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
  ['郑州大学伦敦校区留学生奖学金', 'university', '大学奖学金', '本科/硕士/博士', 1],
  ['郑州大学校长奖学金', 'university', '全额资助', '本科/硕士/博士', 2],
  ['郑州大学河南省政府奖学金', 'government', '单项资助', '本科/硕士/博士', 3]
].map(([name, type, coverage, applicableDegree, sortOrder]) => ({
  name,
  type,
  coverage,
  applicableDegree,
  requirementText: '具体申请条件以学校当年说明为准。',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 28 个项目；本脚本录入截图可见 16 个项目、4 条 CSCA 规则和 3 项奖学金。' }
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
