const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '同济大学',
  nameEn: 'Tongji University',
  rank: 42,
  schoolType: 'regular',
  region: 'Shanghai, East China China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '汉语言专业（国际教育）经贸方向：HSK 四级（180 分）可免考文科中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理。部分专业需增加化学。',
  cscaRequirementNote: '985；211 双一流高校；英文授课专业仅需数学 + 物理；化学、机械、汽车、生命科学等考全部四门。',
  undergradRequirements: '截图显示同济大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  applicationSteps: '先按目标专业确认授课语言和 CSCA 科目；英文授课专业重点核对数学、物理要求。',
  tuitionSummary: '¥24,000 - ¥45,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥24,000 - ¥30,000/年',
    englishPrograms: '¥35,000 - ¥45,000/年',
    livingCost: '约 ¥4,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China China',
      livingCostLabel: '~¥4,500/月',
      displayProgramCount: 63,
      displayUndergraduateCount: 65,
      visibleProgramCount: 13,
      hiddenProgramNote: '还有50个汉语授课专业',
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '中文授课专业', total: 60, visibleCount: 10, hiddenNote: '还有50个汉语授课专业' },
        { key: 'english_program', label: '英文授课专业', total: 3, visibleCount: 3 }
      ],
      programFieldTags: [
        'Architecture',
        'Civil Engineering',
        'Medicine',
        'Computer Science',
        'Mechanical Engineering',
        'Automotive Engineering',
        'Environmental Science',
        'Economics and Management',
        'Law',
        'Arts and Media',
        '+1个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥4,500/月。',
  scholarships: [],
  englishPrograms: 'Architecture (International Class)、Clinical Medicine MBBS、Civil Engineering (International Class)。',
  notablePrograms: 'Architecture (International Class)、Clinical Medicine MBBS、Civil Engineering (International Class)、Materials Science and Engineering、New Energy Materials and Devices、Surveying Engineering、Electrical Engineering and Automation、Telecommunications Engineering、Microelectronics Science and Engineering、Artificial Intelligence、Automation、Law、Sports Training。',
  programFields: 'Architecture、Civil Engineering、Medicine、Computer Science、Mechanical Engineering、Automotive Engineering、Environmental Science、Economics and Management、Law、Arts and Media。',
  source: 'csca-reference-screenshot',
  sourceId: 'tongji-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Architecture (International Class)', 'Architecture (International Class)', 'Architecture', '英文授课', ['数学'], 45000, '¥45,000/年', '5', 1],
  ['Clinical Medicine MBBS', 'Clinical Medicine MBBS', 'Medicine', '英文授课', ['数学', '化学'], 45000, '¥45,000/年', '6', 2],
  ['Civil Engineering (International Class)', 'Civil Engineering (International Class)', 'Civil Engineering', '英文授课', ['数学', '物理'], 35000, '¥35,000/年', '4', 3],
  ['Materials Science and Engineering', 'Materials Science and Engineering', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 4],
  ['New Energy Materials and Devices', 'New Energy Materials and Devices', 'Materials Science', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 5],
  ['Surveying Engineering', 'Surveying Engineering', 'Civil Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 6],
  ['Electrical Engineering and Automation', 'Electrical Engineering and Automation', 'Electrical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 7],
  ['Telecommunications Engineering', 'Telecommunications Engineering', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 8],
  ['Microelectronics Science and Engineering', 'Microelectronics Science and Engineering', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 9],
  ['Artificial Intelligence', 'Artificial Intelligence', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 10],
  ['Automation', 'Automation', 'Electrical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 30000, '¥30,000/年', '4', 11],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 12],
  ['Sports Training', 'Sports Training', 'Sports', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', '4', 13]
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
    scope: '文科、人文、法学等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工类专业',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理科中文 + 数学 + 物理。',
    sortOrder: 2
  },
  {
    title: '化学',
    category: 'science',
    scope: '化学、机械、汽车、生命科学等方向',
    cscaSubjects: ['化学'],
    description: '部分专业需物理 + 化学。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言专业（国际教育经贸方向）',
    cscaSubjects: [],
    languageCondition: '汉语言专业（国际教育）经贸方向：HSK 四级（180 分）可免考文科中文。',
    description: '仅汉语言专业相关方向适用，其他专业以项目页面为准。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '985；211 双一流高校；英文授课专业仅需数学 + 物理；化学、机械、汽车、生命科学等考全部四门。',
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
    log: { note: '截图显示共 63 个可选专业；本脚本录入截图可见 13 个。' }
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
