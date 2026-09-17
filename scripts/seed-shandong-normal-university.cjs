const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '山东师范大学',
  nameEn: 'Shandong Normal University',
  schoolType: 'regular',
  region: 'Jinan, North China China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '汉语言专业：提供有效期内 HSK 四级成绩报告可免考文科中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理；化学方向按截图补充化学。',
  cscaRequirementNote: '商学院专业（旅游管理、物流管理、工商管理）需考全部四门科目。',
  undergradRequirements: '截图显示山东师范大学本科项目均为中文授课；汉语言专业可凭有效期内 HSK 四级成绩报告免考文科中文。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '部分项目截止：2026 年 6 月 30 日。',
  round1CloseDate: '2026-06-30',
  applicationSteps: '按专业类别准备文科中文或理科中文、数学、物理/化学；商学院相关专业按截图提示准备全部四门科目。',
  tuitionSummary: '¥14,000 - ¥18,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥14,000 - ¥18,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Jinan',
      regionLabel: 'North China China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 18,
      displayUndergraduateCount: 18,
      visibleProgramCount: 10,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 18, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-30',
          label: '部分项目截止',
          dateLabel: 'Jun 30, 2026',
          endDate: '2026-06-30',
          description: '截图显示 Teaching Chinese to Speakers of Other Languages、Chinese Language、Chemical Engineering and Technics、Fine Arts、Calligraphy 等项目截止日期为 2026 年 6 月 30 日。'
        }
      ],
      programFieldTags: [
        'Education',
        'Chinese Language',
        'Chemical Engineering',
        'Fine Arts',
        'Business',
        'Physical Education',
        'Journalism and Communication',
        'Computer Science',
        'Information Technology'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [],
  englishPrograms: null,
  notablePrograms: 'Teaching Chinese to Speakers of Other Languages、Chinese Language、Chemical Engineering and Technics、Fine Arts、Calligraphy、Environmental Design、Tourism Management、Logistics Management、Business Administration、Martial Arts and Traditional Ethnic Sports。',
  programFields: 'Education、Chinese Language、Chemical Engineering、Fine Arts、Business、Physical Education、Journalism and Communication、Computer Science、Information Technology。',
  source: 'csca-reference-screenshot',
  sourceId: 'shandong-normal-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-30T00:00:00.000Z');
const deadlineProgramNames = new Set([
  'Teaching Chinese to Speakers of Other Languages',
  'Chinese Language',
  'Chemical Engineering and Technics',
  'Fine Arts',
  'Calligraphy'
]);

const basePrograms = [
  ['Teaching Chinese to Speakers of Other Languages', 'Teaching Chinese to Speakers of Other Languages', 'Education', ['中文(文科)', '数学'], 14000, '¥14,000/年', 1],
  ['Chinese Language', 'Chinese Language', 'Chinese Language', ['中文(文科)', '数学'], 14000, '¥14,000/年', 2],
  ['Chemical Engineering and Technics', 'Chemical Engineering and Technics', 'Chemical Engineering', ['中文(理科)', '数学', '物理', '化学'], 16000, '¥16,000/年', 3],
  ['Fine Arts', 'Fine Arts', 'Fine Arts', ['中文(文科)', '数学'], 18000, '¥18,000/年', 4],
  ['Calligraphy', 'Calligraphy', 'Fine Arts', ['中文(文科)', '数学'], 18000, '¥18,000/年', 5],
  ['Environmental Design', 'Environmental Design', 'Fine Arts', ['中文(理科)', '数学', '物理', '化学'], 18000, '¥18,000/年', 6],
  ['Tourism Management', 'Tourism Management', 'Business', ['中文(文科)', '数学', '物理', '化学'], 16000, '¥16,000/年', 7],
  ['Logistics Management', 'Logistics Management', 'Business', ['中文(文科)', '数学', '物理', '化学'], 16000, '¥16,000/年', 8],
  ['Business Administration', 'Business Administration', 'Business', ['中文(文科)', '数学', '物理', '化学'], 16000, '¥16,000/年', 9],
  ['Martial Arts and Traditional Ethnic Sports', 'Martial Arts and Traditional Ethnic Sports', 'Physical Education', ['中文(文科)', '数学'], 18000, '¥18,000/年', 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage: '中文授课',
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
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理；化学方向需考物理 + 化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言专业',
    cscaSubjects: [],
    languageCondition: '提供有效期内 HSK 四级成绩报告可免考文科中文。',
    description: '汉语言专业：提供有效期内 HSK 四级成绩报告可免考文科中文。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '商学院专业',
    cscaSubjects: [],
    description: '商学院专业（旅游管理、物流管理、工商管理）需考全部四门科目。',
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
    log: { note: '截图显示 18 个本科项目，录入 10 个可见项目、4 条 CSCA 规则。' }
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
