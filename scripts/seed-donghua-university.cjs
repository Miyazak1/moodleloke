const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '东华大学',
  nameEn: 'Donghua University',
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '申请前 HSK4 级（180 分）；入学前 HSK5 级（180 分）；英语授课需雅思 5.5 或托福 72。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学（艺术设计）、人文、外语类；理工科类按专业匹配理科中文、数学、物理、化学；SCF 英语授课仅需数学。',
  cscaRequirementNote: '211 双一流高校；纺织服装特色；上海国际时尚创意学院（SCF）英语授课仅需数学。',
  undergradRequirements: '截图显示东华大学本科项目包含 2 个英文授课项目和 44 个中文授课项目；SCF 英语授课仅需数学，中文授课按文科/理工科类别匹配 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分中文授课项目截止：2026 年 6 月 1 日。',
  round1CloseDate: '2026-06-01',
  applicationSteps: '中文授课申请前需 HSK4 级，入学前需 HSK5 级；英语授课需雅思或托福成绩；SCF 英语授课按截图仅需数学。',
  tuitionSummary: '¥22,000 - ¥45,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥22,000/年',
    englishPrograms: '¥45,000/年',
    livingCost: '约 ¥2,800/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,800/月',
      displayProgramCount: 46,
      displayUndergraduateCount: 50,
      visibleProgramCount: 12,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 },
        { key: 'chinese_program', label: '汉语授课专业', total: 44, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-01',
          label: '部分中文授课项目截止',
          dateLabel: 'Jun 1, 2026',
          endDate: '2026-06-01',
          description: '截图显示 Fashion and Apparel Design、Fashion Design and Engineering、Product Design、Environmental Design、Visual Communication Design 等项目截止日期为 2026 年 6 月 1 日。'
        }
      ],
      programFieldTags: [
        'Fashion Design',
        'Textile Engineering',
        'Art and Design',
        'Management',
        'Computer Science',
        'Materials Science',
        'Environmental Engineering',
        'Chemistry',
        'Foreign Languages'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,800/月。',
  scholarships: [],
  englishPrograms: 'Fashion & Accessory Design (SCF)、Environmental Design - Fashion Interior (SCF)。',
  notablePrograms: 'Fashion & Accessory Design (SCF)、Environmental Design - Fashion Interior (SCF)、Fashion and Apparel Design、Fashion Design and Engineering、Product Design、Environmental Design、Visual Communication Design、Digital Media Art、International Economics and Trade、Business Administration、Accounting、Finance。',
  programFields: 'Fashion Design、Textile Engineering、Art and Design、Management、Computer Science、Materials Science、Environmental Engineering、Chemistry、Foreign Languages。',
  source: 'csca-reference-screenshot',
  sourceId: 'donghua-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-01T00:00:00.000Z');
const deadlineProgramNames = new Set([
  'Fashion and Apparel Design',
  'Fashion Design and Engineering',
  'Product Design',
  'Environmental Design',
  'Visual Communication Design'
]);

const basePrograms = [
  ['Fashion & Accessory Design (SCF)', 'Fashion & Accessory Design (SCF)', 'Fashion Design', '英文授课', ['数学'], 45000, '¥45,000/年', 1],
  ['Environmental Design - Fashion Interior (SCF)', 'Environmental Design - Fashion Interior (SCF)', 'Art and Design', '英文授课', ['数学'], 45000, '¥45,000/年', 2],
  ['Fashion and Apparel Design', 'Fashion and Apparel Design', 'Fashion Design', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 3],
  ['Fashion Design and Engineering', 'Fashion Design and Engineering', 'Textile Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', 4],
  ['Product Design', 'Product Design', 'Art and Design', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 5],
  ['Environmental Design', 'Environmental Design', 'Environmental Engineering', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 22000, '¥22,000/年', 6],
  ['Visual Communication Design', 'Visual Communication Design', 'Art and Design', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 7],
  ['Digital Media Art', 'Digital Media Art', 'Art and Design', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 8],
  ['International Economics and Trade', 'International Economics and Trade', 'Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 9],
  ['Business Administration', 'Business Administration', 'Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 10],
  ['Accounting', 'Accounting', 'Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 11],
  ['Finance', 'Finance', 'Management', '中文授课', ['中文(文科)', '数学'], 22000, '¥22,000/年', 12]
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
  deadlineDate: deadlineProgramNames.has(nameZh) ? deadlineDate : null,
  deadlineLabel: deadlineProgramNames.has(nameZh) ? 'Jun 1, 2026' : null,
  applicationRound: '2026 本科申请',
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
    scope: '艺术设计、人文、外语类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学（艺术设计）；人文；外语类。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '工科、材料环境、服装工程、生物、化学类',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理（工科类）；理科中文 + 数学 + 化学（材料环境类）；理科中文 + 数学 + 物理 + 化学（服装工程、生物、化学类）。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '授课语言',
    cscaSubjects: [],
    languageCondition: '申请前 HSK4 级（180 分）；入学前 HSK5 级（180 分）；英语授课需雅思 5.5 或托福 72。',
    description: '申请前 HSK4 级（180 分）；入学前 HSK5 级（180 分）；英语授课需雅思 5.5 或托福 72。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '211 双一流高校；纺织服装特色；上海国际时尚创意学院（SCF）英语授课仅需数学。',
    sortOrder: 4
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
    log: { note: '截图显示 46 个可选专业，统计卡显示 50 个本科；录入 12 个可见项目、4 条 CSCA 规则。' }
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
