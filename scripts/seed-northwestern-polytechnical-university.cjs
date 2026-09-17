const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '西北工业大学',
  nameEn: 'Northwestern Polytechnical University',
  schoolType: 'regular',
  region: "Xi'an, Northwest China",
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '中文授课需 HSK 五级（180 分）及以上；英文授课免中文测试。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：中文授课为文科中文 + 数学，英文授课为数学；理工科类：中文授课为理科中文 + 数学 + 物理，英文授课为数学 + 物理。',
  cscaRequirementNote: '985；211 工程高校；材料、生物类专业需考化学而非物理；英文授课文商类仅需数学。',
  undergradRequirements: '截图显示西北工业大学本科项目包含中文授课和英文授课；中文授课需相应中文科目，英文授课免中文测试。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: null,
  round1CloseDate: null,
  applicationSteps: '按授课语言和专业类别确认 CSCA 科目；材料、生物类按截图提示使用化学替代物理。',
  tuitionSummary: '¥22,000 - ¥25,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥22,000/年',
    englishPrograms: '¥25,000/年',
    livingCost: '约 ¥2,000/月',
    display: {
      city: "Xi'an",
      regionLabel: 'Northwest China',
      livingCostLabel: '~¥2,000/月',
      displayProgramCount: 30,
      displayUndergraduateCount: 30,
      visibleProgramCount: 17,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 7, visibleCount: 7 },
        { key: 'chinese_program', label: '汉语授课专业', total: 23, visibleCount: 10 }
      ],
      programFieldTags: [
        'Aerospace Engineering',
        'Materials Science',
        'Computer Science',
        'Mechanical Engineering',
        'Automation',
        'Electrical Engineering',
        'Naval Architecture',
        'Business Administration',
        'International Trade'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,000/月。',
  scholarships: [
    '西北工业大学“启真”“一带一路”外国留学生奖学金',
    '西北工业大学“留学工大校长奖学金”',
    '西北工业大学来华留学生学业专项奖学金（“吴亚军”奖学金）',
    '西北工业大学来华留学生学业专项奖学金（“郭用源”奖学金）'
  ],
  englishPrograms: 'Aerospace Engineering (English)、Materials Science and Engineering (English)、Computer Science and Technology (English)、Mechanical Engineering (English)、Electrical Engineering (English)、Business Administration (English)、International Economics and Trade (English)。',
  notablePrograms: 'Aerospace Engineering、Aircraft Design and Engineering、Materials Science and Engineering、Computer Science and Technology、Software Engineering、Mechanical Engineering、Automation、Electrical Engineering、Naval Architecture and Ocean Engineering、Information Security。',
  programFields: 'Aerospace Engineering、Materials Science、Computer Science、Mechanical Engineering、Automation、Electrical Engineering、Naval Architecture、Business Administration、International Trade。',
  source: 'csca-reference-screenshot',
  sourceId: 'northwestern-polytechnical-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['Aerospace Engineering (English)', 'Aerospace Engineering (English)', 'Aerospace Engineering', '英文授课', ['数学', '物理'], 25000, '¥25,000/年', '4', 1, true],
  ['Materials Science and Engineering (English)', 'Materials Science and Engineering (English)', 'Materials Science', '英文授课', ['数学', '化学'], 25000, '¥25,000/年', '4', 2, true],
  ['Computer Science and Technology (English)', 'Computer Science and Technology (English)', 'Computer Science', '英文授课', ['数学', '物理'], 25000, '¥25,000/年', '4', 3, true],
  ['Mechanical Engineering (English)', 'Mechanical Engineering (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 25000, '¥25,000/年', '4', 4, true],
  ['Electrical Engineering (English)', 'Electrical Engineering (English)', 'Electrical Engineering', '英文授课', ['数学', '物理'], 25000, '¥25,000/年', '4', 5, true],
  ['Business Administration (English)', 'Business Administration (English)', 'Business Administration', '英文授课', ['数学'], 25000, '¥25,000/年', '4', 6, true],
  ['International Economics and Trade (English)', 'International Economics and Trade (English)', 'International Trade', '英文授课', ['数学'], 25000, '¥25,000/年', '4', 7, true],
  ['Aerospace Engineering', 'Aerospace Engineering', 'Aerospace Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 8, true],
  ['Aircraft Design and Engineering', 'Aircraft Design and Engineering', 'Aerospace Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 9, true],
  ['Materials Science and Engineering', 'Materials Science and Engineering', 'Materials Science', '中文授课', ['中文(理科)', '数学', '化学'], 22000, '¥22,000/年', '4', 10, true],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 11, true],
  ['Software Engineering', 'Software Engineering', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 12, true],
  ['Mechanical Engineering', 'Mechanical Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 13, true],
  ['Automation', 'Automation', 'Automation', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 14, true],
  ['Electrical Engineering', 'Electrical Engineering', 'Electrical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 15, true],
  ['Naval Architecture and Ocean Engineering', 'Naval Architecture and Ocean Engineering', 'Naval Architecture', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 16, true],
  ['Information Security', 'Information Security', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 17, true]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder, hasScholarship]) => ({
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
  scholarshipText: hasScholarship ? '有奖学金' : null,
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
    description: '中文授课：文科中文 + 数学；英文授课：数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工科类',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    description: '中文授课：理科中文 + 数学 + 物理；英文授课：数学 + 物理。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '授课语言',
    cscaSubjects: [],
    languageCondition: '中文授课需 HSK 五级（180 分）及以上；英文授课免中文测试。',
    description: '中文授课需 HSK 五级（180 分）及以上；英文授课免中文测试。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '985；211 工程高校；材料、生物类专业需考化学而非物理；英文授课文商类仅需数学。',
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
  '西北工业大学“启真”“一带一路”外国留学生奖学金',
  '西北工业大学“留学工大校长奖学金”',
  '西北工业大学来华留学生学业专项奖学金（“吴亚军”奖学金）',
  '西北工业大学来华留学生学业专项奖学金（“郭用源”奖学金）'
].map((name, index) => ({
  name,
  type: 'university',
  coverage: '大学奖学金',
  applicableDegree: '本科',
  requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
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
    log: { note: '截图显示 30 个本科项目，录入 17 个可见项目、4 条 CSCA 规则和 4 项奖学金。' }
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
