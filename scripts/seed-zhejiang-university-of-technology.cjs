const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '浙江工业大学',
  nameEn: 'Zhejiang University of Technology',
  schoolType: 'regular',
  region: 'Hangzhou, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '部分专业需 HSK5 级；英语授课专业按截图要求匹配 CSCA 科目。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学，并按专业匹配物理或化学。',
  cscaRequirementNote: '浙江省重点大学；英语授课专业丰富；位于杭州。',
  undergradRequirements: '截图显示浙江工业大学本科项目包含英文授课和中文授课；文科/管理/经济/设计类主要为中文与数学，理工类按专业匹配物理或化学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '按授课语言和专业类别确认 CSCA 科目；化工、药学、环境、材料等方向重点准备化学或物理。',
  tuitionSummary: '¥18,000 - ¥26,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000/年',
    englishPrograms: '¥20,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: 'Hangzhou',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 43,
      displayUndergraduateCount: 40,
      visibleProgramCount: 23,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 13, visibleCount: 13 },
        { key: 'chinese_program', label: '汉语授课专业', total: 30, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-15',
          label: '部分项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: '截图显示 Chemical Engineering and Technology (English)、Applied Chemistry (English)、Chemical Engineering and Technology、Pharmacy (English)、Pharmaceutical Engineering 等项目截止日期为 2026 年 6 月 15 日。'
        }
      ],
      programFieldTags: [
        'Chemical Engineering',
        'Pharmacy',
        'Environmental Engineering',
        'Materials Science',
        'Mechanical Engineering',
        'Computer Science',
        'Civil Engineering',
        'Management',
        'Economics',
        'Design'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: [],
  englishPrograms: 'Chemical Engineering and Technology (English)、Applied Chemistry (English)、Pharmacy (English)、Environmental Engineering (English)、Mechanical Engineering (English)、Electrical Engineering and Automation (English)、Computer Science and Technology (English)、Software Engineering (English)、Civil Engineering (English)、Business Administration (English)、International Economics and Trade (English)、Finance (English)、International Economics and Trade - China Business (English)。',
  notablePrograms: 'Chemical Engineering and Technology、Applied Chemistry、Pharmacy、Environmental Engineering、Mechanical Engineering、Computer Science and Technology、Software Engineering、Civil Engineering、Pharmaceutical Engineering、Materials Science and Engineering。',
  programFields: 'Chemical Engineering、Pharmacy、Environmental Engineering、Materials Science、Mechanical Engineering、Computer Science、Civil Engineering、Management、Economics、Design。',
  source: 'csca-reference-screenshot',
  sourceId: 'zhejiang-university-of-technology',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-15T00:00:00.000Z');
const deadlineProgramNames = new Set([
  'Chemical Engineering and Technology (English)',
  'Applied Chemistry (English)',
  'Chemical Engineering and Technology',
  'Pharmacy (English)',
  'Pharmaceutical Engineering'
]);

const basePrograms = [
  ['Chemical Engineering and Technology (English)', 'Chemical Engineering and Technology (English)', 'Chemical Engineering', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 1],
  ['Applied Chemistry (English)', 'Applied Chemistry (English)', 'Chemical Engineering', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 2],
  ['Pharmacy (English)', 'Pharmacy (English)', 'Pharmacy', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 3],
  ['Environmental Engineering (English)', 'Environmental Engineering (English)', 'Environmental Engineering', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 4],
  ['Mechanical Engineering (English)', 'Mechanical Engineering (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 20000, '¥20,000/年', 5],
  ['Electrical Engineering and Automation (English)', 'Electrical Engineering and Automation (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 20000, '¥20,000/年', 6],
  ['Computer Science and Technology (English)', 'Computer Science and Technology (English)', 'Computer Science', '英文授课', ['数学', '物理'], 20000, '¥20,000/年', 7],
  ['Software Engineering (English)', 'Software Engineering (English)', 'Computer Science', '英文授课', ['数学', '物理'], 20000, '¥20,000/年', 8],
  ['Civil Engineering (English)', 'Civil Engineering (English)', 'Civil Engineering', '英文授课', ['数学', '物理'], 20000, '¥20,000/年', 9],
  ['Business Administration (English)', 'Business Administration (English)', 'Management', '英文授课', ['数学'], 20000, '¥20,000/年', 10],
  ['International Economics and Trade (English)', 'International Economics and Trade (English)', 'Economics', '英文授课', ['数学'], 20000, '¥20,000/年', 11],
  ['Finance (English)', 'Finance (English)', 'Economics', '英文授课', ['数学'], 20000, '¥20,000/年', 12],
  ['International Economics and Trade - China Business (English)', 'International Economics and Trade - China Business (English)', 'Economics', '英文授课', ['数学'], 20000, '¥20,000/年', 13],
  ['Chemical Engineering and Technology', 'Chemical Engineering and Technology', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '化学'], 18000, '¥18,000/年', 14],
  ['Pharmaceutical Engineering', 'Pharmaceutical Engineering', 'Pharmacy', '中文授课', ['中文(理科)', '数学', '化学'], 18000, '¥18,000/年', 15],
  ['Environmental Science', 'Environmental Science', 'Environmental Engineering', '中文授课', ['中文(理科)', '数学', '物理', '化学'], 18000, '¥18,000/年', 16],
  ['Materials Science and Engineering', 'Materials Science and Engineering', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 17],
  ['Polymer Materials and Engineering', 'Polymer Materials and Engineering', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 18],
  ['Food Science and Engineering', 'Food Science and Engineering', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '化学'], 18000, '¥18,000/年', 19],
  ['Food Quality and Safety', 'Food Quality and Safety', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '化学'], 18000, '¥18,000/年', 20],
  ['Mechanical Engineering', 'Mechanical Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 21],
  ['Industrial Engineering', 'Industrial Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 22],
  ['Process Equipment and Control Engineering', 'Process Equipment and Control Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 18000, '¥18,000/年', 23]
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
  deadlineLabel: deadlineProgramNames.has(nameZh) ? 'Jun 15, 2026' : null,
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
    scope: '管理、经济、人文、设计类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学（管理、经济、人文、设计类）。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '机械、化学、材料、食品、环境、制药等',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理（机械、计算机、土木等）；理科中文 + 数学 + 化学（化学、材料、食品、环境、制药等）。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '授课语言',
    cscaSubjects: [],
    languageCondition: '部分专业需 HSK5 级；英语授课专业按截图要求匹配 CSCA 科目。',
    description: '部分专业需 HSK5 级；英语授课专业按截图要求匹配 CSCA 科目。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '浙江省重点大学；英语授课专业丰富；位于杭州。',
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
    log: { note: '截图显示 43 个可选专业，统计卡显示 40 个本科；录入 23 个可见项目、4 条 CSCA 规则。' }
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
