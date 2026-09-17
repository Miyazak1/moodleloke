const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京航空航天大学',
  nameEn: 'Beihang University',
  rank: 27,
  schoolType: 'regular',
  region: 'Beijing, North China China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '中文授课需 HSK 五级（180 分）以上；英文授课需 IELTS 6.0 或 TOEFL 90+。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理，部分专业需增加化学。',
  cscaRequirementNote: '985；211 双一流高校；北京校区和杭州国际校区；航空航天类相关专业高校。',
  undergradRequirements: '截图显示北京航空航天大学本科项目包含英文授课和中文授课；理工类主要为数学与物理，部分材料/生命相关方向需化学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按授课语言准备 HSK 或英语成绩；按项目类别确认数学、物理及化学科目。',
  tuitionSummary: '¥25,000 - ¥30,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥25,000/年',
    englishPrograms: '¥30,000/年',
    livingCost: '约 ¥4,000/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China China',
      livingCostLabel: '~¥4,000/月',
      displayProgramCount: 49,
      displayUndergraduateCount: 70,
      visibleProgramCount: 18,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 8, visibleCount: 8 },
        { key: 'chinese_program', label: '汉语授课专业', total: 41, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-30',
          label: '部分中文授课项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 Materials Science and Engineering、Nanomaterials and Technology、Electronic Information Engineering、Communication Engineering、Electronic Science and Technology 等项目截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Aerospace Engineering',
        'Computer Science',
        'Materials Science',
        'Electronic Engineering',
        'Automation',
        'Mechanical Engineering',
        'Artificial Intelligence',
        'Economics and Management',
        'Law',
        'Art and Design'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥4,000/月。',
  scholarships: ['北京航空航天大学外国留学生奖学金'],
  englishPrograms: 'Electronic Information Engineering (English)、Flight Vehicle Design and Engineering (English)、Computer Science and Technology (English)、Mechanical Engineering (English)、Robotics Engineering (English)、Artificial Intelligence (English)、Biomedical Engineering (English)、International Economics and Trade (English)。',
  notablePrograms: 'Electronic Information Engineering、Flight Vehicle Design and Engineering、Computer Science and Technology、Mechanical Engineering、Robotics Engineering、Artificial Intelligence、Biomedical Engineering、International Economics and Trade、Materials Science and Engineering、Nanomaterials and Technology、Automation、Aircraft Environment and Life Support Engineering。',
  programFields: 'Aerospace Engineering、Computer Science、Materials Science、Electronic Engineering、Automation、Mechanical Engineering、Artificial Intelligence、Economics and Management、Law、Art and Design。',
  source: 'csca-reference-screenshot',
  sourceId: 'beihang-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');
const deadlineProgramNames = new Set([
  'Materials Science and Engineering',
  'Nanomaterials and Technology',
  'Electronic Information Engineering',
  'Communication Engineering',
  'Electronic Science and Technology'
]);

const basePrograms = [
  ['Electronic Information Engineering (English)', 'Electronic Information Engineering (English)', 'Electronic Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 1],
  ['Flight Vehicle Design and Engineering (English)', 'Flight Vehicle Design and Engineering (English)', 'Aerospace Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 2],
  ['Computer Science and Technology (English)', 'Computer Science and Technology (English)', 'Computer Science', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 3],
  ['Mechanical Engineering (English)', 'Mechanical Engineering (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 4],
  ['Robotics Engineering (English)', 'Robotics Engineering (English)', 'Automation', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 5],
  ['Artificial Intelligence (English)', 'Artificial Intelligence (English)', 'Artificial Intelligence', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 6],
  ['Biomedical Engineering (English)', 'Biomedical Engineering (English)', 'Biomedical Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 7],
  ['International Economics and Trade (English)', 'International Economics and Trade (English)', 'Economics and Management', '英文授课', ['数学'], 30000, '¥30,000/年', 8],
  ['Materials Science and Engineering', 'Materials Science and Engineering', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 9],
  ['Nanomaterials and Technology', 'Nanomaterials and Technology', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 10],
  ['Electronic Information Engineering', 'Electronic Information Engineering', 'Electronic Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 11],
  ['Communication Engineering', 'Communication Engineering', 'Electronic Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 12],
  ['Electronic Science and Technology', 'Electronic Science and Technology', 'Electronic Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 13],
  ['Automation', 'Automation', 'Automation', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 14],
  ['Robot Engineering', 'Robot Engineering', 'Automation', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 15],
  ['Flight Vehicle Design and Engineering', 'Flight Vehicle Design and Engineering', 'Aerospace Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 16],
  ['Low Altitude Technology and Engineering', 'Low Altitude Technology and Engineering', 'Aerospace Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 17],
  ['Aircraft Environment and Life Support Engineering', 'Aircraft Environment and Life Support Engineering', 'Aerospace Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', 18]
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
  deadlineLabel: deadlineProgramNames.has(nameZh) ? 'Jun 30, 2026' : null,
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
    scope: '文科/人文类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工科类',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学 + 物理；部分专业需增加化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '授课语言',
    cscaSubjects: [],
    languageCondition: '中文授课需 HSK 五级（180 分）以上；英文授课需 IELTS 6.0 或 TOEFL 90+。',
    description: '中文授课需 HSK 五级（180 分）以上；英文授课需 IELTS 6.0 或 TOEFL 90+。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '985；211 双一流高校；北京校区和杭州国际校区；航空航天类相关专业高校。',
    sortOrder: 4
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
    name: '北京航空航天大学外国留学生奖学金',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '本科',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sourceUrl: null,
    sourceLabel: SOURCE_LABEL,
    lastVerifiedAt: VERIFIED_AT,
    sortOrder: 1,
    status: SchoolStatus.published
  }
];

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 49 个可选专业，统计卡显示 70 个本科；录入 18 个可见项目、4 条 CSCA 规则和 1 项奖学金。' }
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
