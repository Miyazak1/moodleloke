const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '中南大学',
  nameEn: 'Central South University',
  schoolType: 'regular',
  region: 'Changsha, Central China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '无免考政策，所有专业均为中文授课。',
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理，化学任选其一。',
  cscaRequirementNote: '985；211 双一流 A 类高校；湘雅医学院为国内顶尖医学院；中国政府奖学金国别双边项目。',
  undergradRequirements: '截图显示中南大学本科项目均为中文授课，按文科/人文类和理工科类分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  applicationSteps: '先确认目标专业所属文理科分类；理工科项目按理科中文、数学、物理，并根据专业选择化学。',
  tuitionSummary: '¥20,000 - ¥30,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥20,000 - ¥30,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Changsha',
      regionLabel: 'Central China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 79,
      displayUndergraduateCount: 79,
      visibleProgramCount: 10,
      hiddenProgramNote: '还有69个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学', '物理', '化学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 79, visibleCount: 10, hiddenNote: '还有69个汉语授课专业' }
      ],
      programFieldTags: [
        'Humanities',
        'Architecture',
        'Art',
        'Business',
        'Law',
        'Public Administration',
        'Sports',
        'Mathematics',
        'Physics',
        'Electronics',
        '+14个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: [],
  englishPrograms: '',
  notablePrograms: 'Chinese Language and Literature、Digital Publishing、Philosophy、Architecture、Urban and Rural Planning、Dance Performance、Musical Performance、Art and Technology、Business Administration、Information Management and Information System。',
  programFields: 'Humanities、Architecture、Art、Business、Law、Public Administration、Sports、Mathematics、Physics、Electronics。',
  source: 'csca-reference-screenshot',
  sourceId: 'central-south-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Chinese Language and Literature', 'Chinese Language and Literature', 'Humanities', ['中文(文科)', '数学'], 20000, '¥20,000/年', '4', 1],
  ['Digital Publishing', 'Digital Publishing', 'Humanities', ['中文(文科)', '数学'], 20000, '¥20,000/年', '4', 2],
  ['Philosophy', 'Philosophy', 'Humanities', ['中文(文科)', '数学'], 20000, '¥20,000/年', '4', 3],
  ['Architecture', 'Architecture', 'Architecture', ['中文(理科)', '数学', '物理'], 26000, '¥26,000/年', '5', 4],
  ['Urban and Rural Planning', 'Urban and Rural Planning', 'Architecture', ['中文(文科)', '数学'], 26000, '¥26,000/年', '5', 5],
  ['Dance Performance', 'Dance Performance', 'Art', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 6],
  ['Musical Performance', 'Musical Performance', 'Art', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 7],
  ['Art and Technology', 'Art and Technology', 'Art', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 8],
  ['Business Administration', 'Business Administration', 'Business', ['中文(文科)', '数学'], 20000, '¥20,000/年', '4', 9],
  ['Information Management and Information System', 'Information Management and Information System', 'Business', ['中文(理科)', '数学', '物理'], 20000, '¥20,000/年', '4', 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears,
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: '无免考政策，所有专业均为中文授课。',
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
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学(中文) + 物理；化学任选其一。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '全部本科专业',
    cscaSubjects: [],
    languageCondition: '无免考政策，所有专业均为中文授课。',
    description: '截图显示无免考政策，所有专业均为中文授课。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '985；211 双一流 A 类高校；湘雅医学院为国内顶尖医学院；中国政府奖学金国别双边项目。',
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
    log: { note: '截图显示 79 个本科专业；本脚本录入截图可见 10 个专业和 4 条 CSCA 规则。' }
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
