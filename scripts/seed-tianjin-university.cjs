const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '天津大学',
  nameEn: 'Tianjin University',
  rank: 39,
  schoolType: 'regular',
  region: 'Tianjin, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '国际教育学院本科学生 HSK4 级 180 分以上可免文科中文；英文授课专业按项目要求确认。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学 + 人文艺术；理工科类：理科中文 + 数学 + 物理；化工、环境等方向按数学 + 化学准备。',
  cscaRequirementNote: '985；211 双一流；中国第一所现代大学；化工、建筑、机械全国顶尖；3 个英文授课专业。',
  undergradRequirements: '截图显示天津大学本科项目按文科/人文类、理工科类、化工环境方向和 HSK 免考政策分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 5 月 11 日。',
  round1CloseDate: '2026-05-11',
  applicationSteps: '先按目标专业确认授课语言和 CSCA 科目，再核对项目截止日期与奖学金申请条件。',
  tuitionSummary: '¥18,600 - ¥26,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,600 - ¥26,000/年',
    englishPrograms: '¥20,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: 'Tianjin',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 67,
      displayUndergraduateCount: 67,
      visibleProgramCount: 13,
      hiddenProgramNote: '还有54个本科专业',
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 3, visibleCount: 3 },
        { key: 'chinese_program', label: '汉语授课专业', total: 64, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-11',
          label: '部分项目截止',
          dateLabel: 'May 11, 2026',
          endDate: '2026-05-11',
          description: '截图显示 Applied Chemistry、Applied Physics、Architecture、Automation、Biological Engineering 等项目截止日期为 2026 年 5 月 11 日。'
        }
      ],
      programFieldTags: [
        'Chemical Engineering',
        'Architecture',
        'Civil Engineering',
        'Mechanical Engineering',
        'Materials Science',
        'Computer Science',
        'Electrical Engineering',
        'Environmental Science',
        'Marine Science',
        'Mathematics'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: [
    '天津大学化工学院留学生化工优秀专项奖学金',
    '天津大学外国留学生奖学金',
    '天津大学建筑工程学院留学生专项奖学金',
    '天津大学环境与资源学院留学生专项奖学金'
  ],
  englishPrograms: 'Chemical Engineering and Technology (English)、Environmental Engineering (English)、Pharmaceutical Science (English)。',
  notablePrograms: 'Chemical Engineering and Technology、Environmental Engineering、Pharmaceutical Science、Chinese Language and Literature、Fine Chemical Engineering、Process Equipment and Control Engineering、Biomedical Engineering、Intelligent Medical Engineering、Biological Engineering、Pharmaceutical Engineering、Food Science and Engineering、Synthetic Biology。',
  programFields: 'Chemical Engineering、Architecture、Civil Engineering、Mechanical Engineering、Materials Science、Computer Science、Electrical Engineering、Environmental Science、Marine Science、Mathematics。',
  source: 'csca-reference-screenshot',
  sourceId: 'tianjin-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-11T00:00:00.000Z');
const deadlineNames = new Set(['Applied Chemistry', 'Applied Physics', 'Architecture', 'Automation', 'Biological Engineering']);

const basePrograms = [
  ['Chemical Engineering and Technology (English)', 'Chemical Engineering and Technology (English)', 'Chemical Engineering', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 1],
  ['Environmental Engineering (English)', 'Environmental Engineering (English)', 'Environmental Science', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 2],
  ['Pharmaceutical Science (English)', 'Pharmaceutical Science (English)', 'Pharmaceutical Science', '英文授课', ['数学', '化学'], 20000, '¥20,000/年', 3],
  ['Chinese Language and Literature', 'Chinese Language and Literature', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 18600, '¥18,600/年', 4],
  ['Fine Chemical Engineering', 'Fine Chemical Engineering', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', 5],
  ['Chemical Engineering and Technology', 'Chemical Engineering and Technology', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', 6],
  ['Process Equipment and Control Engineering', 'Process Equipment and Control Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 7],
  ['Biomedical Engineering', 'Biomedical Engineering', 'Biomedical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 8],
  ['Intelligent Medical Engineering', 'Intelligent Medical Engineering', 'Biomedical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', 9],
  ['Biological Engineering', 'Biological Engineering', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', 10],
  ['Pharmaceutical Engineering', 'Pharmaceutical Engineering', 'Chemical Engineering', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', 11],
  ['Food Science and Engineering', 'Food Science and Engineering', 'Food Science', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', 12],
  ['Synthetic Biology', 'Synthetic Biology', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 20000, '¥20,000/年', 13]
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
  scholarshipText: '有奖学金',
  deadlineDate: deadlineNames.has(nameZh) ? deadlineDate : null,
  deadlineLabel: deadlineNames.has(nameZh) ? 'May 11, 2026' : null,
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
    scope: '建筑、教育、数学、法学、管理经管等方向',
    cscaSubjects: ['中文(文科)', '数学', '人文艺术'],
    description: '文科中文 + 数学 + 人文艺术。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '材料、计算、口腔、微电子、土木、海洋、医学等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学 + 物理。',
    sortOrder: 2
  },
  {
    title: '化工、环境方向',
    category: 'science',
    scope: '化工、环境、药学等方向',
    cscaSubjects: ['数学', '化学'],
    description: '数学 + 化学；英文授课相关项目无需中文成绩。',
    sortOrder: 3
  },
  {
    title: '生命科学方向',
    category: 'science',
    scope: '生命科学等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理 + 化学。',
    sortOrder: 4
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '国际教育学院本科学生及英文授课专业',
    cscaSubjects: [],
    languageCondition: '国际教育学院本科学生 HSK4 级 180 分以上可免文科中文；英文授课专业按项目要求确认。',
    description: '环境工程等英文授课项目无需中文成绩，仅考数学 + 化学。',
    sortOrder: 5
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '985；211 双一流；中国第一所现代大学；化工、建筑、机械全国顶尖；3 个英文授课专业。',
    sortOrder: 6
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  '天津大学化工学院留学生化工优秀专项奖学金',
  '天津大学外国留学生奖学金',
  '天津大学建筑工程学院留学生专项奖学金',
  '天津大学环境与资源学院留学生专项奖学金'
].map((name, index) => ({
  name,
  type: 'university',
  coverage: '大学奖学金',
  applicableDegree: '本科',
  applicableProgram: '天津大学国际学生本科项目',
  requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
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
    log: { note: '截图显示 67 个本科专业；录入 13 个可见项目、6 条 CSCA 规则和 4 项奖学金。' }
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
