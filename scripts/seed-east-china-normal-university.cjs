const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/east-china-normal-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '华东师范大学',
  nameEn: 'East China Normal University',
  rank: 43,
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: 'https://www.ecnu.edu.cn/',
  applicationSystemUrl: 'https://lxs.ecnu.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '国际汉语文化学院汉语言专业可按项目规则免考；商务类项目、英文授课设计等方向需按专业确认。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理，部分化学、生物、环境方向需增加化学。',
  cscaRequirementNote: 'HSK4 可免文科中文；具体免考资格需按专业页面和当年招生说明确认。',
  undergradRequirements: '截图参考页显示华东师范大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '先按目标专业确认授课语言、CSCA 科目和 HSK 免考条件，再核对项目截止日期和奖学金申请要求。',
  tuitionSummary: '¥22,000 - ¥105,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥22,000 - ¥24,000/年',
    englishPrograms: '¥105,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 23,
      displayUndergraduateCount: 23,
      visibleProgramCount: 12,
      hiddenProgramNote: '还有11个本科专业',
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)', '中文(理科)'],
      programFieldTags: [
        'Accounting',
        'Biology',
        'Business Administration',
        'Chemistry',
        'Economics',
        'Environmental and Ecological Sciences',
        'Journalism and Media',
        'Law',
        'Philosophy and Psychology',
        'Physical Education',
        '+1个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [
    '华东师范大学上海市政府奖学金',
    '华东师范大学中国政府奖学金自主招生项目',
    '华东师范大学优秀外国留学生奖学金',
    '华东师范大学优秀外国留学生学生奖学金',
    '华东师范大学优秀本科新生奖学金',
    '国际中文教师奖学金',
    '上海市外国留学生政府奖学金 A 类',
    '上海市外国留学生政府奖学金 B 类',
    '华东师范大学国际学生卓越奖',
    '学院专项奖学金'
  ],
  englishPrograms: 'Business Administration、Double Degree Global BBA。',
  notablePrograms: 'Business Administration、Double Degree Global BBA、Accounting、Administration Management、Applied Psychology、Biology Science、Biology Technology、Chemistry、Economics、Environmental Science。',
  programFields: 'Accounting、Biology、Business Administration、Chemistry、Economics、Environmental and Ecological Sciences、Journalism and Media、Law、Philosophy and Psychology、Physical Education。',
  source: 'csca-reference-screenshot',
  sourceId: 'east-china-normal-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Business Administration', 'Business Administration', 'Business Administration', '英文授课', ['数学'], 105000, '¥105,000/年', 1],
  ['Double Degree Global BBA - Bachelor of Business Administration (Asia Europe Business School)', 'Double Degree Global BBA - Bachelor of Business Administration (Asia Europe Business School)', 'Business Administration', '英文授课', ['数学'], 105000, '¥105,000/年', 2],
  ['Accounting', 'Accounting', 'Accounting', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', 3],
  ['Administration Management', 'Administration Management', 'Public Administration', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', 4],
  ['Applied Psychology', 'Applied Psychology', 'Psychology', '中文授课', ['中文(理科)', '数学', '物理'], 24000, '¥24,000/年', 5],
  ['Biology Science', 'Biology Science', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 24000, '¥24,000/年', 6],
  ['Biology Technology', 'Biology Technology', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 24000, '¥24,000/年', 7],
  ['Business Administration (Faculty of Economics and Management Asia Europe Business School)', 'Business Administration (Faculty of Economics and Management Asia Europe Business School)', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', 8],
  ['Business Administration (Faculty of Economics and Management School of Economics and Management)', 'Business Administration (Faculty of Economics and Management School of Economics and Management)', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', 9],
  ['Chemistry', 'Chemistry', 'Chemistry', '中文授课', ['中文(理科)', '数学', '化学'], 24000, '¥24,000/年', 10],
  ['Economics', 'Economics', 'Economics', '中文授课', ['中文(文科)', '数学'], 24000, '¥24,000/年', 11],
  ['Environmental Science', 'Environmental Science', 'Environmental and Ecological Sciences', '中文授课', ['中文(理科)', '数学', '化学'], 24000, '¥24,000/年', 12]
];

const deadlineNames = new Set(['Accounting', 'Administration Management', 'Applied Psychology', 'Biology Science', 'Biology Technology']);

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '按英文授课项目要求确认。' : '中文授课项目按专业确认 HSK 要求。',
  englishRequirement: teachingLanguage === '英文授课' ? '需提交英语能力证明，具体以项目页面为准。' : undefined,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: '有奖学金',
  deadlineDate: deadlineNames.has(nameZh) ? new Date('2026-06-15T00:00:00.000Z') : undefined,
  deadlineLabel: deadlineNames.has(nameZh) ? 'Jun 15, 2026' : undefined,
  applicationRound: deadlineNames.has(nameZh) ? '2026 本科申请' : undefined,
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
    scope: '外语、外商、人文、法学、社会、管理、艺术、体育等方向',
    cscaSubjects: ['文科中文', '数学'],
    description: '文科/人文类按文科中文和数学准备。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '数学、计算机、教育技术、物理、地理、电子、信息等方向',
    cscaSubjects: ['理科中文', '数学', '物理'],
    description: '理工科类按理科中文、数学和物理准备。',
    sortOrder: 2
  },
  {
    title: '化学、生物、环境方向',
    category: 'science',
    scope: '化学、生物、生态、环境等方向',
    cscaSubjects: ['理科中文', '数学', '物理', '化学'],
    description: '部分理科方向需增加化学，申请前按目标专业确认。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考资格',
    category: 'language_policy',
    scope: '国际汉语文化学院汉语言专业、商务类项目、英文授课设计等方向',
    cscaSubjects: [],
    languageCondition: 'HSK4 可免文科中文；具体免考资格以项目页面为准。',
    description: '语言免考资格因专业而异，申请前需逐项确认。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: 'HSK4 可免文科中文；英文授课与商务类项目需重点核对科目组合。',
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
  ['华东师范大学上海市政府奖学金', 'government', '全额资助'],
  ['华东师范大学中国政府奖学金自主招生项目', 'csc', '全额资助'],
  ['华东师范大学优秀外国留学生奖学金', 'university', '大学奖学金'],
  ['华东师范大学优秀外国留学生学生奖学金', 'university', '大学奖学金'],
  ['华东师范大学优秀本科新生奖学金', 'university', '大学奖学金'],
  ['国际中文教师奖学金', 'government', '全额或部分资助'],
  ['上海市外国留学生政府奖学金 A 类', 'government', '全额资助'],
  ['上海市外国留学生政府奖学金 B 类', 'government', '部分资助'],
  ['华东师范大学国际学生卓越奖', 'university', '大学奖学金'],
  ['学院专项奖学金', 'university', '学院奖学金']
].map(([name, type, coverage], index) => ({
  name,
  type,
  coverage,
  applicableDegree: '本科',
  applicableProgram: '华东师范大学国际学生本科项目',
  amountText: '以学校当年通知为准。',
  requirementText: '需满足学校国际学生申请要求，并按奖学金通知提交材料。',
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
    log: { note: '已按新学校详情结构重刷华东师范大学；截图显示共 23 个本科专业，本脚本录入截图可见 12 个。' }
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
