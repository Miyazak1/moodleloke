const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '华中科技大学',
  nameEn: 'Huazhong University of Science and Technology',
  schoolType: 'regular',
  region: 'Wuhan, Central China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '理工医学类 HSK4 级 180 分以上；经管人文类 HSK5 级 180 分以上；前置学历汉语授课且符合相应条件可免 HSK。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学(中文) + 物理(中文) + 化学；英语授课专业：数学(英文) + 物理(英文) + 化学。',
  cscaRequirementNote: '985；211 双一流 A 类高校；同济医学院中国顶尖；光学工程全国领先；人工智能与自动化学科交叉科技成果突出。',
  undergradRequirements: '截图显示华中科技大学本科项目按文科/人文类、理工科类和英语授课专业分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '先确认目标专业授课语言；中文授课按文科中文或理科中文组合准备，英文授课按英文数学、物理、化学组合准备。',
  tuitionSummary: '¥18,000 - ¥40,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥18,000 - ¥25,000/年',
    englishPrograms: '¥30,000 - ¥40,000/年',
    livingCost: '约 ¥1,800/月',
    display: {
      city: 'Wuhan',
      regionLabel: 'Central China',
      livingCostLabel: '~¥1,800/月',
      displayProgramCount: 54,
      displayUndergraduateCount: 55,
      visibleProgramCount: 15,
      hiddenProgramNote: '还有40个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 5, visibleCount: 5 },
        { key: 'chinese_program', label: '汉语授课专业', total: 49, visibleCount: 10, hiddenNote: '还有40个汉语授课专业' },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: 'Mechanical Engineering、Electrical Engineering、Electronic Information Engineering、Computer Science and Technology、Software Engineering 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Engineering',
        'Science',
        'Medicine',
        'Economics',
        'Management',
        'Law',
        'Literature',
        'Art',
        'Education'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,800/月。',
  scholarships: [],
  englishPrograms: 'Clinical Medicine MBBS (English)、Pharmacy (English)、Communication Engineering (English)、Mechanical Design and Manufacturing (English)、Biomedical Engineering (English)。',
  notablePrograms: 'Clinical Medicine MBBS (English)、Pharmacy (English)、Communication Engineering (English)、Mechanical Design and Manufacturing (English)、Biomedical Engineering (English)、Mechanical Engineering、Electrical Engineering、Electronic Information Engineering、Computer Science and Technology、Software Engineering、Communication Engineering、Automation、Artificial Intelligence、Civil Engineering、Architecture。',
  programFields: 'Engineering、Science、Medicine、Economics、Management、Law、Literature、Art、Education。',
  source: 'csca-reference-screenshot',
  sourceId: 'huazhong-university-of-science-and-technology',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-15T00:00:00.000Z');
const deadlineNames = new Set([
  'Mechanical Engineering',
  'Electrical Engineering',
  'Electronic Information Engineering',
  'Computer Science and Technology',
  'Software Engineering'
]);

const basePrograms = [
  ['Clinical Medicine MBBS (English)', 'Clinical Medicine MBBS (English)', 'Medicine', '英文授课', ['数学', '化学'], 40000, '¥40,000/年', '6', 1],
  ['Pharmacy (English)', 'Pharmacy (English)', 'Medicine', '英文授课', ['数学', '化学'], 35000, '¥35,000/年', '4', 2],
  ['Communication Engineering (English)', 'Communication Engineering (English)', 'Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', '4', 3],
  ['Mechanical Design and Manufacturing (English)', 'Mechanical Design and Manufacturing (English)', 'Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', '4', 4],
  ['Biomedical Engineering (English)', 'Biomedical Engineering (English)', 'Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', '4', 5],
  ['Mechanical Engineering', 'Mechanical Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 6],
  ['Electrical Engineering', 'Electrical Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 7],
  ['Electronic Information Engineering', 'Electronic Information Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 8],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 9],
  ['Software Engineering', 'Software Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 10],
  ['Communication Engineering', 'Communication Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 11],
  ['Automation', 'Automation', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 12],
  ['Artificial Intelligence', 'Artificial Intelligence', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 13],
  ['Civil Engineering', 'Civil Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '4', 14],
  ['Architecture', 'Architecture', 'Architecture', '中文授课', ['中文(理科)', '数学', '物理'], 25000, '¥25,000/年', '5', 15]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears,
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课专业按项目语言要求确认。' : '中文授课按专业类别确认 HSK4/HSK5 要求。',
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: '有奖学金',
  deadlineDate: deadlineNames.has(nameZh) ? deadlineDate : undefined,
  deadlineLabel: deadlineNames.has(nameZh) ? 'Jun 15, 2026' : undefined,
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
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学(中文) + 物理(中文) + 化学；考试语言为中文。',
    sortOrder: 2
  },
  {
    title: '英语授课专业',
    category: 'english_program',
    scope: '英文授课本科项目',
    cscaSubjects: ['数学', '物理', '化学'],
    description: '数学(英文) + 物理(英文) + 化学；考试语言为英文。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '理工医学类、经管人文类及前置学历汉语授课申请人',
    cscaSubjects: [],
    languageCondition: '理工医学类 HSK4 级 180 分以上；经管人文类 HSK5 级 180 分以上；前置学历汉语授课且符合相应条件可免 HSK。',
    description: '按截图显示的专业类别和前置学历语言条件判断 HSK 要求。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '985；211 双一流 A 类高校；同济医学院中国顶尖；光学工程全国领先；人工智能与自动化学科交叉科技成果突出。',
    sortOrder: 5
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
    log: { note: '截图显示 54 个可选专业、统计卡 55 个本科；本脚本录入截图可见 15 个专业和 5 条 CSCA 规则。' }
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
