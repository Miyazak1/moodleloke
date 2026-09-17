const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/fudan-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '复旦大学',
  nameEn: 'Fudan University',
  rank: 40,
  schoolType: 'regular',
  region: 'Shanghai, East China',
  officialWebsite: 'https://www.fudan.edu.cn/',
  applicationSystemUrl: 'https://iso.fudan.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 级 180 分以上可免考文科中文；仅限汉语专业。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理，化学、生物、医学类需理科中文 + 数学 + 物理 + 化学。',
  cscaRequirementNote: '中文授课项目；英文授课：MBBS（6年）、UIPE 经济学。',
  undergradRequirements: '截图参考页显示复旦大学本科项目按文科/人文类、理工科类和 HSK 免考政策分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  applicationSteps: '先按目标专业确认授课语言和 CSCA 科目；英文授课项目重点核对 MBBS 与 UIPE 经济学要求。',
  tuitionSummary: '¥23,000 - ¥80,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥23,000/年',
    mbbs: '¥75,000/年',
    uipe: '¥80,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Shanghai',
      regionLabel: 'East China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 63,
      displayUndergraduateCount: 63,
      visibleProgramCount: 12,
      hiddenProgramNote: '还有51个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学', '化学', '物理'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 61, visibleCount: 10, hiddenNote: '还有51个汉语授课专业' },
        { key: 'english_program', label: '英语授课专业', total: 2, visibleCount: 2 }
      ],
      programFieldTags: [
        'Advertising',
        'Artificial Intelligence',
        'Atmospheric Science',
        'Biology',
        'Biomedical Engineering',
        'Business Administration',
        'Chemistry',
        'Chinese Language',
        'Communication',
        'Computer Science',
        '+48个更多'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [],
  englishPrograms: 'MBBS、Undergraduate International Program in Economics (UIPE)。',
  notablePrograms: 'MBBS、Undergraduate International Program in Economics (UIPE)、Chinese Language、Chinese Language and Literature、History、Museology、Philosophy、Religious Studies、Law、English。',
  programFields: 'Advertising、Artificial Intelligence、Atmospheric Science、Biology、Biomedical Engineering、Business Administration、Chemistry、Chinese Language、Communication、Computer Science。',
  source: 'csca-reference-screenshot',
  sourceId: 'fudan-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['MBBS', 'MBBS', 'Medicine', '英文授课', ['数学', '化学'], 75000, '¥75,000/年', '6', 1],
  ['Undergraduate International Program in Economics (UIPE)', 'Undergraduate International Program in Economics (UIPE)', 'Economics', '英文授课', ['数学'], 80000, '¥80,000/年', '4', 2],
  ['Chinese Language (International Language and Culture)', 'Chinese Language (International Language and Culture)', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 3],
  ['Chinese Language (International Business Chinese)', 'Chinese Language (International Business Chinese)', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 4],
  ['Chinese Language and Literature', 'Chinese Language and Literature', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 5],
  ['Chinese Language', 'Chinese Language', 'Chinese Language', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 6],
  ['History', 'History', 'History', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 7],
  ['Museology', 'Museology', 'History', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 8],
  ['Philosophy', 'Philosophy', 'Philosophy', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 9],
  ['Religious Studies', 'Religious Studies', 'Philosophy', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 10],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 11],
  ['English', 'English', 'Foreign Languages', '中文授课', ['中文(文科)', '数学'], 23000, '¥23,000/年', '4', 12]
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
    scope: '人文社科类、经济管理类、外语类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '人文社科类、经济管理类、外语类按文科中文 + 数学准备。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工类专业',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '理工类专业按理科中文 + 数学 + 物理准备。',
    sortOrder: 2
  },
  {
    title: '化学、生物、医学类',
    category: 'science',
    scope: '化学、生物、医学类专业',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '化学、生物、医学类按理科中文 + 数学 + 物理 + 化学准备。',
    sortOrder: 3
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语专业',
    cscaSubjects: [],
    languageCondition: 'HSK4 级 180 分以上可免考文科中文；仅限汉语专业。',
    description: '申请前需确认目标专业是否适用中文科目免考。',
    sortOrder: 4
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '授课语言',
    cscaSubjects: [],
    description: '中文授课项目；英文授课：MBBS（6年）、UIPE 经济学。',
    sortOrder: 5
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    log: { note: '截图显示共 63 个本科专业；本脚本录入截图可见 12 个。' }
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
