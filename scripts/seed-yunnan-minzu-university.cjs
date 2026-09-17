const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '云南民族大学',
  nameEn: 'Yunnan Minzu University',
  schoolType: 'regular',
  region: 'Kunming, Southwest China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：数学 + 中文。',
  cscaRequirementNote: '更多细节待发布。',
  undergradRequirements: '截图显示云南民族大学本科项目均为中文授课，文科/人文类专业需中文(文科) + 数学，部分理科/艺术类项目按卡片补充物理、化学等科目。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 5 月 30 日。',
  round1CloseDate: '2026-05-30',
  applicationSteps: '按目标项目确认中文(文科/理科)、数学、物理、化学等组合；更多细节以学校后续发布为准。',
  tuitionSummary: '¥10,000 - ¥15,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥10,000 - ¥15,000/年',
    livingCost: '约 ¥1,300/月',
    display: {
      city: 'Kunming',
      regionLabel: 'Southwest China',
      livingCostLabel: '~¥1,300/月',
      displayProgramCount: 12,
      displayUndergraduateCount: 12,
      visibleProgramCount: 10,
      displaySubjectTags: ['数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 12, visibleCount: 10, hiddenNote: '还有 2 个汉语授课专业' }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-30',
          label: '本科项目截止',
          dateLabel: 'May 30, 2026',
          endDate: '2026-05-30',
          description: '截图显示 Architecture、Chemistry、Chinese Language、Ecology、Fine Arts 等项目截止日期为 2026 年 5 月 30 日。'
        }
      ],
      programFieldTags: [
        'Accounting',
        'Biology',
        'Business Administration',
        'Chemistry',
        'Economics',
        'Journalism and Media',
        'Law'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,300/月。',
  scholarships: [
    '云南民族大学中国政府奖学金',
    '云南民族大学云南省政府奖学金'
  ],
  englishPrograms: '',
  notablePrograms: 'Architecture、Chemistry、Chinese Language、Ecology、Fine Arts、International Economy and Trade、Law、Logistics Management、Philosophy、Public Administration。截图展示 12 个项目中的 10 个。',
  programFields: 'Accounting、Biology、Business Administration、Chemistry、Economics、Journalism and Media、Law。',
  source: 'csca-reference-screenshot',
  sourceId: 'yunnan-minzu-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-30T00:00:00.000Z');

const basePrograms = [
  ['Architecture', 'Architecture', 'Architecture', ['中文(理科)', '数学', '物理'], 11000, '¥11,000/年', 1],
  ['Chemistry', 'Chemistry', 'Chemistry', ['中文(理科)', '数学', '物理', '化学'], 11000, '¥11,000/年', 2],
  ['Chinese Language', 'Chinese Language', 'Journalism and Media', ['中文(文科)', '数学'], 10000, '¥10,000/年', 3],
  ['Ecology', 'Ecology', 'Biology', ['中文(文科)', '数学'], 11000, '¥11,000/年', 4],
  ['Fine Arts', 'Fine Arts', 'Journalism and Media', ['中文(文科)', '数学'], 15000, '¥15,000/年', 5],
  ['International Economy and Trade', 'International Economy and Trade', 'Economics', ['中文(文科)', '数学'], 10000, '¥10,000/年', 6],
  ['Law', 'Law', 'Law', ['中文(文科)', '数学'], 10000, '¥10,000/年', 7],
  ['Logistics Management', 'Logistics Management', 'Business Administration', ['中文(文科)', '数学'], 10000, '¥10,000/年', 8],
  ['Philosophy', 'Philosophy', 'Law', ['中文(文科)', '数学'], 10000, '¥10,000/年', 9],
  ['Public Administration', 'Public Administration', 'Business Administration', ['中文(文科)', '数学'], 10000, '¥10,000/年', 10]
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
  deadlineDate,
  deadlineLabel: 'May 30, 2026',
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
    description: '数学 + 中文。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '后续说明',
    cscaSubjects: [],
    description: '更多细节待发布。',
    sortOrder: 2
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
    name: '云南民族大学中国政府奖学金',
    type: 'csc',
    coverage: '全额资助',
    applicableDegree: '本科',
    requirementText: '中国政府奖学金项目，具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 1,
    status: SchoolStatus.published
  },
  {
    name: '云南民族大学云南省政府奖学金',
    type: 'government',
    coverage: '省级奖学金',
    applicableDegree: '本科',
    requirementText: '省级奖学金，具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 2,
    status: SchoolStatus.published
  }
];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 12 个本科项目；本脚本录入截图可见 10 个项目、2 条 CSCA 规则和 2 项奖学金。' }
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
