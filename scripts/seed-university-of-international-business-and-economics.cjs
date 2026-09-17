const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/university-of-international-business-and-economics';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '对外经济贸易大学',
  nameEn: 'University of International Business and Economics',
  rank: 50,
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: 'https://www.uibe.edu.cn/',
  applicationSystemUrl: 'https://sie.uibe.edu.cn/',
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：数学 + 中文。',
  cscaRequirementNote: '提供奖学金类型：中国政府奖学金、北京市政府奖学金、国际中文教师奖学金、对外经济贸易大学奖学金。',
  undergradRequirements: '截图参考页显示对外经济贸易大学本科项目按文科/人文类判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '中文授课项目按中文 + 数学准备；英文授课项目按数学准备。',
  tuitionSummary: '¥24,800 - ¥49,750/年。',
  tuitionByCategory: {
    chinesePrograms: '¥24,800/年',
    englishPrograms: '¥49,750/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 12,
      displayUndergraduateCount: 18,
      visibleProgramCount: 12,
      displaySubjectTags: ['数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 6, visibleCount: 6 },
        { key: 'english_program', label: '英语授课专业', total: 6, visibleCount: 6 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '部分本科项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'Accounting、Business Administration、Economics、Finance、International Economics and Trade 等项目显示该截止日期。'
        }
      ],
      programFieldTags: ['Business Administration', 'Economics', 'Law']
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: ['对外经济贸易大学荣誉留学校长奖学金', '对外经贸大学国际学院'],
  englishPrograms: 'Business Administration、Economics、Finance、International Economics and Trade、International Politics、Marketing。',
  notablePrograms: 'Business Administration、Economics、Finance、International Economics and Trade、International Politics、Marketing、Accounting、Logistics Management。',
  programFields: 'Business Administration、Economics、Law。',
  source: 'csca-reference-screenshot',
  sourceId: 'university-of-international-business-and-economics',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Business Administration', 'Business Administration', 'Business Administration', '英文授课', ['数学'], 49750, '¥49,750/年', '3.5', 1, false],
  ['Economics', 'Economics', 'Economics', '英文授课', ['数学'], 49750, '¥49,750/年', '4', 2, true],
  ['Finance', 'Finance', 'Economics', '英文授课', ['数学'], 49750, '¥49,750/年', '3.5', 3, false],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '英文授课', ['数学'], 49750, '¥49,750/年', '4', 4, false],
  ['International Politics', 'International Politics', 'Law', '英文授课', ['数学'], 49750, '¥49,750/年', '4', 5, false],
  ['Marketing', 'Marketing', 'Business Administration', '英文授课', ['数学'], 49750, '¥49,750/年', '4', 6, false],
  ['Accounting', 'Accounting', 'Accounting', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 7, true],
  ['Business Administration', 'Business Administration', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 8, true],
  ['Finance', 'Finance', 'Economics', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 9, true],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 10, true],
  ['Logistics Management', 'Logistics Management', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 11, false],
  ['Marketing', 'Marketing', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 12, false]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder, hasDeadline]) => ({
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
  deadlineDate: hasDeadline ? new Date('2026-06-30T00:00:00.000Z') : undefined,
  deadlineLabel: hasDeadline ? 'Jun 30, 2026' : undefined,
  applicationRound: hasDeadline ? '2026 本科申请' : undefined,
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
    scope: '经贸、管理、法政等方向',
    cscaSubjects: ['数学', '中文(文科)'],
    description: '数学 + 中文。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '奖学金',
    cscaSubjects: [],
    description: '提供奖学金类型：中国政府奖学金、北京市政府奖学金、国际中文教师奖学金、对外经济贸易大学奖学金。',
    sortOrder: 2
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  {
    name: '对外经济贸易大学荣誉留学校长奖学金',
    type: 'university',
    applicableDegree: '本科',
    applicableProgram: '对外经济贸易大学国际学生本科项目',
    requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
    sortOrder: 1
  },
  {
    name: '对外经贸大学国际学院',
    type: 'government',
    coverage: '全额资助',
    applicableDegree: '本科',
    applicableProgram: '对外经济贸易大学国际学生本科项目',
    requirementText: '政府奖学金，具体申请条件以学校当年通知为准。',
    sortOrder: 2
  }
].map((scholarship) => ({
  ...scholarship,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示共 12 个可见专业、本科统计 18；本脚本录入截图可见 12 个专业、截止日期与奖学金。' }
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
