const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '浙江工商大学',
  nameEn: 'Zhejiang Gongshang University',
  schoolType: 'regular',
  region: 'Hangzhou, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '商务汉语专业 HSK4 级 180 分及以上可免文科中文科目。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学；英文授课专业：数学。',
  cscaRequirementNote: '艺术设计类专业按文科要求，计算机类按理科要求；金融学 CFA 项目另需 38,000 元；4 年 CFA 项目费。',
  undergradRequirements: '截图显示浙江工商大学本科项目按文科/人文类、理工科类和英文授课专业分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先确认目标专业授课语言和文理科分类；英文授课专业准备数学，中文授课按文科中文或理科中文搭配数学。',
  tuitionSummary: '¥18,000 - ¥25,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000 - ¥25,000/年',
    englishPrograms: '¥18,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: 'Hangzhou',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 25,
      displayUndergraduateCount: 25,
      visibleProgramCount: 16,
      hiddenProgramNote: '还有9个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 6, visibleCount: 6 },
        { key: 'chinese_program', label: '汉语授课专业', total: 19, visibleCount: 10, hiddenNote: '还有9个汉语授课专业' },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Philosophy、Accounting、Financial Management、Auditing、Computer Science and Technology 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Philosophy',
        'Accounting',
        'Finance',
        'Computer Science',
        'Art & Design',
        'E-commerce',
        'Law',
        'Hospitality'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: ['浙江工商大学国际学生奖学金'],
  englishPrograms: 'International Business (English)、Law - International Law (English)、Accounting (English)、Hospitality Management (English)、E-commerce (English)、Logistics Management (English)。',
  notablePrograms: 'International Business (English)、Law - International Law (English)、Accounting (English)、Hospitality Management (English)、E-commerce (English)、Logistics Management (English)、Philosophy、Accounting、Financial Management、Auditing、Computer Science and Technology、Software Engineering、Information Security、Finance (CFA Program)、Visual Communication Design、Environmental Design。',
  programFields: 'Philosophy、Accounting、Finance、Computer Science、Art & Design、E-commerce、Law、Hospitality。',
  source: 'csca-reference-screenshot',
  sourceId: 'zhejiang-gongshang-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');
const deadlineNames = new Set([
  'Philosophy',
  'Accounting',
  'Financial Management',
  'Auditing',
  'Computer Science and Technology'
]);

const basePrograms = [
  ['International Business (English)', 'International Business (English)', 'Business Administration', '英文授课', ['数学'], 18000, '¥18,000/年', 1],
  ['Law - International Law (English)', 'Law - International Law (English)', 'Law', '英文授课', ['数学'], 18000, '¥18,000/年', 2],
  ['Accounting (English)', 'Accounting (English)', 'Accounting', '英文授课', ['数学'], 18000, '¥18,000/年', 3],
  ['Hospitality Management (English)', 'Hospitality Management (English)', 'Hospitality', '英文授课', ['数学'], 18000, '¥18,000/年', 4],
  ['E-commerce (English)', 'E-commerce (English)', 'E-commerce', '英文授课', ['数学'], 18000, '¥18,000/年', 5],
  ['Logistics Management (English)', 'Logistics Management (English)', 'Logistics Management', '英文授课', ['数学'], 18000, '¥18,000/年', 6],
  ['Philosophy', 'Philosophy', 'Philosophy', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 7],
  ['Accounting', 'Accounting', 'Accounting', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 8],
  ['Financial Management', 'Financial Management', 'Finance', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 9],
  ['Auditing', 'Auditing', 'Accounting', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 10],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 24000, '¥24,000/年', 11],
  ['Software Engineering', 'Software Engineering', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 24000, '¥24,000/年', 12],
  ['Information Security', 'Information Security', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 24000, '¥24,000/年', 13],
  ['Finance (CFA Program)', 'Finance (CFA Program)', 'Finance', '中文授课', ['中文(文科)', '数学'], 18000, '¥18,000/年', 14],
  ['Visual Communication Design', 'Visual Communication Design', 'Art & Design', '中文授课', ['中文(文科)', '数学'], 25000, '¥25,000/年', 15],
  ['Environmental Design', 'Environmental Design', 'Art & Design', '中文授课', ['中文(文科)', '数学'], 25000, '¥25,000/年', 16]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课专业按项目语言要求确认。' : '中文授课专业按截图 HSK 政策确认。',
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: '有奖学金',
  deadlineDate: deadlineNames.has(nameZh) ? deadlineDate : undefined,
  deadlineLabel: deadlineNames.has(nameZh) ? 'Jun 30, 2026' : undefined,
  applicationRound: deadlineNames.has(nameZh) ? '2026 本科申请' : undefined,
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
    scope: '中文授课文科/人文类专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学；考试语言为中文。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '中文授课理工科类专业',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学；考试语言为中文。',
    sortOrder: 2
  },
  {
    title: '英文授课专业',
    category: 'english_program',
    scope: '英文授课本科项目',
    cscaSubjects: ['数学'],
    description: '英文授课专业需准备数学，考试语言为英文。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '商务汉语专业',
    cscaSubjects: [],
    languageCondition: '商务汉语专业 HSK4 级 180 分及以上可免文科中文科目。',
    description: '商务汉语专业 HSK4 级 180 分及以上可免文科中文科目。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '艺术设计类专业按文科要求，计算机类按理科要求；金融学 CFA 项目另需 38,000 元；4 年 CFA 项目费。',
    sortOrder: 5
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '浙江工商大学国际学生奖学金',
  type: 'university',
  coverage: '大学奖学金',
  applicableDegree: '本科',
  applicableProgram: '浙江工商大学国际学生项目',
  amountText: '以学校当年通知为准。',
  requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
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
    log: { note: '截图显示共 25 个本科专业；本脚本录入截图可见 16 个专业、截止日期摘要和 1 项奖学金。' }
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
