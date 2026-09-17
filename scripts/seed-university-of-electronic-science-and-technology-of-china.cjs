const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/university-of-electronic-science-and-technology-of-china';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '电子科技大学',
  nameEn: 'University of Electronic Science and Technology of China',
  rank: 28,
  schoolType: 'regular',
  region: 'Chengdu, Southwest China',
  officialWebsite: 'https://www.uestc.edu.cn/',
  applicationSystemUrl: 'http://admission.uestc.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '分英文和中文授课需看要求。',
  cscaRequired: true,
  cscaRequirement: '理工科类：英文授课数学 + 物理；中文授课按专业方向选择中文 + 数学 + 物理、中文 + 数学 + 物理 + 化学或中文 + 数学 + 化学。',
  cscaRequirementNote: '分英文和中文授课需看要求。',
  undergradRequirements: '截图参考页显示电子科技大学本科项目按理工科类、授课语言和专业方向判断 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '先按授课语言确认 CSCA 科目；中文授课项目按专业方向确认物理或化学组合。',
  tuitionSummary: '¥15,000/年。',
  tuitionByCategory: {
    undergraduate: '¥15,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Chengdu',
      regionLabel: 'Southwest China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 3,
      displayUndergraduateCount: 3,
      visibleProgramCount: 3,
      displaySubjectTags: ['数学', '化学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 3, visibleCount: 3 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Biomedical Engineering、Mechanical Design Manufacture and Automation、Urban Management 三个项目显示该截止日期。'
        }
      ],
      programFieldTags: ['Biology', 'Mechanical and Manufacturing Engineering', 'Urban Planning']
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['桂林电子科技大学校长奖学金', '电子科技大学外国留学生新生奖学金', '西安电子科技大学华山奖学金'],
  notablePrograms: 'Biomedical Engineering、Mechanical Design Manufacture and Automation、Urban Management。',
  programFields: 'Biology、Mechanical and Manufacturing Engineering、Urban Planning。',
  source: 'csca-reference-screenshot',
  sourceId: 'university-of-electronic-science-and-technology-of-china',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Biomedical Engineering', 'Biomedical Engineering', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 15000, '¥15,000/年', 1],
  ['Mechanical Design Manufacture and Automation', 'Mechanical Design Manufacture and Automation', 'Mechanical and Manufacturing Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 15000, '¥15,000/年', 2],
  ['Urban Management', 'Urban Management', 'Urban Planning', '中文授课', ['中文(文科)', '数学'], 15000, '¥15,000/年', 3]
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
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  deadlineDate: new Date('2026-06-30T00:00:00.000Z'),
  deadlineLabel: 'Jun 30, 2026',
  applicationRound: '2026 本科申请',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '理工科类',
    category: 'science',
    scope: '电子信息、计算机、软件等英文授课方向',
    cscaSubjects: ['数学', '物理'],
    description: '英文授课：数学 + 物理。电子信息、计算机、软件等方向适用。',
    sortOrder: 1
  },
  {
    title: '中文授课：中文 + 数学 + 物理',
    category: 'science',
    scope: '电子、通信、计算机、生物医学、机械、电气、软件',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '电子、通信、计算机、生物医学、机械、电气、软件等方向按中文 + 数学 + 物理准备。',
    sortOrder: 2
  },
  {
    title: '中文 + 数学 + 物理 + 化学',
    category: 'science',
    scope: '新能源材料',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '新能源材料方向按中文 + 数学 + 物理 + 化学准备。',
    sortOrder: 3
  },
  {
    title: '中文 + 数学 + 化学',
    category: 'science',
    scope: '生物技术、护理、临床医学',
    cscaSubjects: ['中文(理科)', '数学', '化学'],
    description: '生物技术、护理、临床医学方向按中文 + 数学 + 化学准备。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '授课语言',
    cscaSubjects: [],
    description: '分英文和中文授课需看要求。',
    sortOrder: 5
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  '桂林电子科技大学校长奖学金',
  '电子科技大学外国留学生新生奖学金',
  '西安电子科技大学华山奖学金'
].map((name, index) => ({
  name,
  type: 'university',
  coverage: index === 1 ? '全额资助' : undefined,
  applicableDegree: '本科',
  applicableProgram: '电子科技大学国际学生本科项目',
  requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: index + 1,
  status: SchoolStatus.published
}));

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
