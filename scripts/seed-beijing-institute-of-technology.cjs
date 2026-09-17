const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京理工大学',
  nameEn: 'Beijing Institute of Technology',
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: 'HSK5 级 > 180（中文授课）；英语授课需雅思 6.0 或托福 85。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '理工科类：数学 + 物理；材料、化学类需化学；管理、人文、设计类部分专业仅需数学。',
  cscaRequirementNote: '985；211 双一流高校；北京、珠海校区；有奖学金；部分专业仅需数学。',
  undergradRequirements: '截图显示北京理工大学本科项目包含英文授课和中文授课；理工类主要为数学与物理，材料化学类匹配化学，管理、人文、设计类部分专业仅需数学。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分项目截止：2026 年 6 月 1 日。',
  round1CloseDate: '2026-06-01',
  applicationSteps: '按授课语言确认语言成绩要求；中文授课需 HSK5 级，英语授课需雅思或托福成绩；按专业类别准备数学、物理或化学。',
  tuitionSummary: '¥23,000 - ¥30,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥23,000/年',
    englishPrograms: '¥30,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 38,
      displayUndergraduateCount: 45,
      visibleProgramCount: 17,
      displaySubjectTags: ['数学', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 7, visibleCount: 7 },
        { key: 'chinese_program', label: '汉语授课专业', total: 31, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-01',
          label: '部分项目截止',
          dateLabel: 'Jun 1, 2026',
          endDate: '2026-06-01',
          description: '截图显示 Aerospace Engineering、Aerospace Engineering (English)、Mechanical Engineering、Mechanical Engineering (English)、Vehicle Engineering 等项目截止日期为 2026 年 6 月 1 日。'
        }
      ],
      programFieldTags: [
        'Aerospace Engineering',
        'Mechanical Engineering',
        'Electronic Engineering',
        'Computer Science',
        'Materials Science',
        'Chemistry',
        'Management',
        'Law',
        'Foreign Languages',
        'Design'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [],
  englishPrograms: 'Aerospace Engineering (English)、Mechanical Engineering (English)、Electronic Science and Technology (English)、Computer Science and Technology (English)、Artificial Intelligence (English)、Automation (English)、International Economics and Trade (English)。',
  notablePrograms: 'Aerospace Engineering、Mechanical Engineering、Vehicle Engineering、Energy and Power Engineering、Electronic Information Engineering、Communication Engineering、Computer Science and Technology、Software Engineering、Artificial Intelligence、Data Science and Big Data Technology。',
  programFields: 'Aerospace Engineering、Mechanical Engineering、Electronic Engineering、Computer Science、Materials Science、Chemistry、Management、Law、Foreign Languages、Design。',
  source: 'csca-reference-screenshot',
  sourceId: 'beijing-institute-of-technology',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-01T00:00:00.000Z');
const deadlineProgramNames = new Set([
  'Aerospace Engineering',
  'Aerospace Engineering (English)',
  'Mechanical Engineering',
  'Mechanical Engineering (English)',
  'Vehicle Engineering'
]);

const basePrograms = [
  ['Aerospace Engineering (English)', 'Aerospace Engineering (English)', 'Aerospace Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 1],
  ['Mechanical Engineering (English)', 'Mechanical Engineering (English)', 'Mechanical Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 2],
  ['Electronic Science and Technology (English)', 'Electronic Science and Technology (English)', 'Electronic Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 3],
  ['Computer Science and Technology (English)', 'Computer Science and Technology (English)', 'Computer Science', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 4],
  ['Artificial Intelligence (English)', 'Artificial Intelligence (English)', 'Computer Science', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 5],
  ['Automation (English)', 'Automation (English)', 'Electronic Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', 6],
  ['International Economics and Trade (English)', 'International Economics and Trade (English)', 'Management', '英文授课', ['数学'], 30000, '¥30,000/年', 7],
  ['Aerospace Engineering', 'Aerospace Engineering', 'Aerospace Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 8],
  ['Mechanical Engineering', 'Mechanical Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 9],
  ['Vehicle Engineering', 'Vehicle Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 10],
  ['Energy and Power Engineering', 'Energy and Power Engineering', 'Mechanical Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 11],
  ['Electronic Information Engineering', 'Electronic Information Engineering', 'Electronic Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 12],
  ['Communication Engineering', 'Communication Engineering', 'Electronic Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 13],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 14],
  ['Software Engineering', 'Software Engineering', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 15],
  ['Artificial Intelligence', 'Artificial Intelligence', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 16],
  ['Data Science and Big Data Technology', 'Data Science and Big Data Technology', 'Computer Science', '中文授课', ['中文(理科)', '数学', '物理'], 23000, '¥23,000/年', 17]
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
    title: '理工科类',
    category: 'science',
    scope: '理工类、材料化学类、管理/人文/设计类',
    cscaSubjects: ['数学', '物理', '化学'],
    description: '数学 + 物理（理工类）；化学（材料、化学类）；管理、人文、设计类部分专业仅需数学。',
    sortOrder: 1
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '授课语言',
    cscaSubjects: [],
    languageCondition: 'HSK5 级 > 180（中文授课）；英语授课需雅思 6.0 或托福 85。',
    description: 'HSK5 级 > 180（中文授课）；英语授课需雅思 6.0 或托福 85。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '985；211 双一流高校；北京、珠海校区；有奖学金；部分专业仅需数学。',
    sortOrder: 3
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
    log: { note: '截图显示 38 个可选专业，统计卡显示 45 个本科；录入 17 个可见项目、3 条 CSCA 规则。' }
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
