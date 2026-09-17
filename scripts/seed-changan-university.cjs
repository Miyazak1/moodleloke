const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '长安大学',
  nameEn: "Chang'an University",
  rank: 45,
  schoolType: 'regular',
  region: "Xi'an, Northwest China",
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '中文授课本科生需 HSK4 级 180 分以上；可申请一年汉语补习。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学(中文) + 物理；英语授课专业按数学、物理、化学组合准备。',
  cscaRequirementNote: '211 双一流高校；中国交通运输领域项目最有影响力高校；CSCA 考试适用于 2026 年 5 月 31 日报批次。',
  undergradRequirements: '截图显示长安大学本科项目按文科/人文类、理工科类和英文授课专业分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: null,
  round1CloseDate: null,
  applicationSteps: '先确认目标专业授课语言；中文授课按文科中文或理科中文搭配数学和物理，英文授课按英文数学、物理、化学组合准备。',
  tuitionSummary: '¥22,000 - ¥28,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥22,000 - ¥25,000/年',
    englishPrograms: '¥22,000 - ¥28,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: "Xi'an",
      regionLabel: 'Northwest China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 59,
      displayUndergraduateCount: 59,
      visibleProgramCount: 24,
      hiddenProgramNote: '还有35个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 14, visibleCount: 14 },
        { key: 'chinese_program', label: '汉语授课专业', total: 45, visibleCount: 10, hiddenNote: '还有35个汉语授课专业' }
      ],
      programFieldTags: [
        'Highway Engineering',
        'Automotive',
        'Mechanical Engineering',
        'Economics & Management',
        'Electronics & Control',
        'Information Engineering',
        'Geology & Surveying',
        'Civil Engineering',
        'Water & Environment',
        'Architecture',
        '+11个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: ['长安大学校级来华留学生奖学金'],
  englishPrograms: 'Mechanical Engineering (English)、International Economy and Trade (English)、Computer Science and Technology (English)、Electronic Information Engineering (English)、Geology (English)、Civil Engineering (English)、Materials Science and Engineering (English)、Road Bridge and River-crossing Engineering (English)、Architecture (English)、Vehicle Engineering (English)、Logistics Engineering (English)、Automotive Service Engineering (English)、Intelligent Vehicle Engineering (English)、Land Resource Management (English)。',
  notablePrograms: 'Mechanical Engineering (English)、International Economy and Trade (English)、Computer Science and Technology (English)、Electronic Information Engineering (English)、Geology (English)、Civil Engineering (English)、Materials Science and Engineering (English)、Road Bridge and River-crossing Engineering (English)、Architecture (English)、Vehicle Engineering (English)、Logistics Engineering (English)、Automotive Service Engineering (English)、Intelligent Vehicle Engineering (English)、Land Resource Management (English)、Road Bridge and River-crossing Engineering、Urban Underground Space Engineering、Intelligent Vehicle Engineering、Vehicle Engineering、Logistics Engineering、Automotive Service Engineering、Mechanical Engineering、Business Administration、Project Management、Economics。',
  programFields: 'Highway Engineering、Automotive、Mechanical Engineering、Economics & Management、Electronics & Control、Information Engineering、Geology & Surveying、Civil Engineering、Water & Environment、Architecture。',
  source: 'csca-reference-screenshot',
  sourceId: 'changan-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Mechanical Engineering (English)', 'Mechanical Engineering (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 1],
  ['International Economy and Trade (English)', 'International Economy and Trade (English)', 'Economics & Management', '英文授课', ['数学'], 22000, '¥22,000/年', 2],
  ['Computer Science and Technology (English)', 'Computer Science and Technology (English)', 'Information Engineering', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 3],
  ['Electronic Information Engineering (English)', 'Electronic Information Engineering (English)', 'Electronics & Control', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 4],
  ['Geology (English)', 'Geology (English)', 'Geology & Surveying', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 5],
  ['Civil Engineering (English)', 'Civil Engineering (English)', 'Civil Engineering', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 6],
  ['Materials Science and Engineering (English)', 'Materials Science and Engineering (English)', 'Materials Science', '英文授课', ['数学', '物理', '化学'], 22000, '¥22,000/年', 7],
  ['Road Bridge and River-crossing Engineering (English)', 'Road Bridge and River-crossing Engineering (English)', 'Highway Engineering', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 8],
  ['Architecture (English)', 'Architecture (English)', 'Architecture', '英文授课', ['数学'], 24000, '¥24,000/年', 9],
  ['Vehicle Engineering (English)', 'Vehicle Engineering (English)', 'Automotive', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 10],
  ['Logistics Engineering (English)', 'Logistics Engineering (English)', 'Economics & Management', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 11],
  ['Automotive Service Engineering (English)', 'Automotive Service Engineering (English)', 'Automotive', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 12],
  ['Intelligent Vehicle Engineering (English)', 'Intelligent Vehicle Engineering (English)', 'Automotive', '英文授课', ['数学', '物理'], 22000, '¥22,000/年', 13],
  ['Land Resource Management (English)', 'Land Resource Management (English)', 'Economics & Management', '英文授课', ['数学'], 22000, '¥22,000/年', 14],
  ['Road Bridge and River-crossing Engineering', 'Road Bridge and River-crossing Engineering', 'Highway Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 15],
  ['Urban Underground Space Engineering', 'Urban Underground Space Engineering', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 16],
  ['Intelligent Vehicle Engineering', 'Intelligent Vehicle Engineering', 'Automotive', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 17],
  ['Vehicle Engineering', 'Vehicle Engineering', 'Automotive', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 18],
  ['Logistics Engineering', 'Logistics Engineering', 'Economics & Management', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 19],
  ['Automotive Service Engineering', 'Automotive Service Engineering', 'Automotive', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 20],
  ['Mechanical Engineering', 'Mechanical Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 21],
  ['Business Administration', 'Business Administration', 'Economics & Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 22],
  ['Project Management', 'Project Management', 'Economics & Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 23],
  ['Economics', 'Economics', 'Economics & Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 24]
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
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课专业按项目语言要求确认。' : '中文授课本科生需 HSK4 级 180 分以上。',
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
    scope: '中文授课文科/人文类专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学；考试语言为中文。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '中文授课理工科类专业',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学(中文) + 物理；考试语言为中文。',
    sortOrder: 2
  },
  {
    title: '英语授课专业',
    category: 'english_program',
    scope: '英文授课本科项目',
    cscaSubjects: ['数学', '物理', '化学'],
    description: '数学(英文) 或 数学(英文)+物理(英文) 或 数学(英文)+物理(英文)+化学(英文)，按专业确认。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '中文授课本科项目',
    cscaSubjects: [],
    languageCondition: '中文授课本科生需 HSK4 级 180 分以上；可申请一年汉语补习；HSK5 级 180 分以上。',
    description: '截图显示中文授课本科生需 HSK4 级 180 分以上，可申请一年汉语补习。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '211 双一流高校；中国交通运输领域项目最有影响力高校；CSCA 考试适用于 2026 年 5 月 31 日报批次。',
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
  name: '长安大学校级来华留学生奖学金',
  type: 'university',
  coverage: '大学奖学金',
  applicableDegree: '本科',
  applicableProgram: '长安大学国际学生项目',
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
    log: { note: '截图显示共 59 个本科专业；本脚本录入截图可见 24 个专业和 1 项奖学金。' }
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
