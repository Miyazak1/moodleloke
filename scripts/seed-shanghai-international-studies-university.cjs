const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/shanghai-international-studies-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '上海外国语大学',
  nameEn: 'Shanghai International Studies University',
  rank: 51,
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: 'https://www.shisu.edu.cn/',
  applicationSystemUrl: 'https://oisa.shisu.edu.cn/',
  admissionLevel: ['本科', '硕士'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：中文 + 数学。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图参考页显示上海外国语大学项目按文科/人文类判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: 'International Economics and Trade (Hongkou Campus) 截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按文科/人文类准备中文 + 数学；英文授课硕士项目按数学、物理等项目要求确认。',
  tuitionSummary: '¥24,800 - ¥26,000/年。',
  tuitionByCategory: {
    undergraduate: '¥24,800/年',
    master: '¥26,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 11,
      displayUndergraduateCount: 9,
      displayPostgraduateCount: 2,
      visibleProgramCount: 11,
      displaySubjectTags: ['数学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 9, visibleCount: 9 },
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '即将截止项目',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: 'International Economics and Trade (Hongkou Campus) 显示该截止日期。'
        }
      ],
      programFieldTags: ['Biology', 'Business Administration', 'Economics', 'Law', 'Political Science']
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: ['上海外国语大学学校奖学金'],
  englishPrograms: 'Finance、Global Communication。',
  notablePrograms: 'Finance、Global Communication、Accounting、Business Administration、Finance、International Economics and Trade、International Economics and Trade (Hongkou Campus)、International Economics and Trade (Japanese)、International Politics (Songjiang Campus)、Law、Political Science and Administration。',
  programFields: 'Biology、Business Administration、Economics、Law、Political Science。',
  source: 'csca-reference-screenshot',
  sourceId: 'shanghai-international-studies-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Finance', 'Finance', 'Economics', '硕士', '英文授课', ['数学'], 26000, '¥26,000/年', '2', 1, false],
  ['Global Communication', 'Global Communication', 'Political Science', '硕士', '英文授课', ['数学', '物理'], 26000, '¥26,000/年', '2', 2, false],
  ['Accounting', 'Accounting', 'Accounting', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 3, false],
  ['Business Administration (Business Administration, Marketing Management, Financial Management and Public Relations)', 'Business Administration (Business Administration, Marketing Management, Financial Management and Public Relations)', 'Business Administration', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 4, false],
  ['Finance', 'Finance', 'Economics', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 5, false],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 6, false],
  ['International Economics and Trade(Hongkou Campus)', 'International Economics and Trade(Hongkou Campus)', 'Economics', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 7, true],
  ['International Economics and Trade(Japanese)', 'International Economics and Trade(Japanese)', 'Economics', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 8, false],
  ['International Politics(Songjiang Campus)', 'International Politics(Songjiang Campus)', 'Political Science', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 9, false],
  ['Law', 'Law', 'Law', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 10, false],
  ['Political Science and Administration', 'Political Science and Administration', 'Political Science', '本科', '中文授课', ['中文(文科)', '数学'], 24800, '¥24,800/年', '4', 11, false]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, degreeLevel, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder, hasDeadline]) => ({
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
    scope: '外语、经贸、管理、法政等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '已确认。',
    sortOrder: 2
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '上海外国语大学学校奖学金',
  type: 'university',
  applicableDegree: '本科/硕士',
  applicableProgram: '上海外国语大学国际学生项目',
  requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
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
    log: { note: '截图显示共 11 个可选项目；本脚本录入截图可见全部项目、截止日期与奖学金。' }
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
