const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '大连交通大学',
  nameEn: 'Dalian Jiaotong University',
  schoolType: 'regular',
  region: 'Dalian, Northeast China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '各科目 ≥50 分或排名前 60%。',
  cscaRequired: true,
  cscaRequirement: '理工科类：专业中文 + 数学；理工类需选考物理或化学。',
  cscaRequirementNote: '已确认。',
  undergradRequirements: '截图显示大连交通大学本科项目均为中文授课，理工类专业需中文(理科)、数学，并按项目匹配物理或化学。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '本科项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '按目标项目确认数学、物理、化学组合；达到 HSK 免考条件可按截图政策处理。',
  tuitionSummary: '¥15,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥15,000/年',
    livingCost: '约 ¥1,500/月',
    display: {
      city: 'Dalian',
      regionLabel: 'Northeast China',
      livingCostLabel: '~¥1,500/月',
      displayProgramCount: 4,
      displayUndergraduateCount: 4,
      visibleProgramCount: 4,
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 4, visibleCount: 4 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-06-15',
          label: '本科项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: '截图显示 Applied Chemistry、Business Administration、Civil Engineering、Energy Chemistry Engineering 项目截止日期为 2026 年 6 月 15 日。'
        }
      ],
      programFieldTags: [
        'Business Administration',
        'Chemistry',
        'Civil Engineering'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,500/月。',
  scholarships: [],
  englishPrograms: '',
  notablePrograms: 'Applied Chemistry、Business Administration、Civil Engineering、Energy Chemistry Engineering。截图展示 4 个本科项目。',
  programFields: 'Business Administration、Chemistry、Civil Engineering。',
  source: 'csca-reference-screenshot',
  sourceId: 'dalian-jiaotong-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-15T00:00:00.000Z');

const basePrograms = [
  ['Applied Chemistry', 'Applied Chemistry', 'Chemistry', ['中文(理科)', '数学', '物理', '化学'], 1],
  ['Business Administration', 'Business Administration', 'Business Administration', ['中文(文科)', '数学'], 2],
  ['Civil Engineering', 'Civil Engineering', 'Civil Engineering', ['中文(理科)', '数学', '物理'], 3],
  ['Energy Chemistry Engineering', 'Energy Chemistry Engineering', 'Chemistry', ['中文(理科)', '数学', '物理', '化学'], 4]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, cscaSubjects, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount: 15000,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥15,000/年',
  deadlineDate,
  deadlineLabel: 'Jun 15, 2026',
  applicationRound: '2026 本科申请',
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
    scope: '理工类需选考物理或化学',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '专业中文 + 数学。',
    languageCondition: '理工类需选考物理或化学。',
    sortOrder: 1
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '免考成绩',
    cscaSubjects: [],
    languageCondition: '各科目 ≥50 分或排名前 60%。',
    description: '达到截图显示的分数条件可按免考政策处理。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '要求状态',
    cscaSubjects: [],
    description: '已确认。',
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
    log: { note: '截图显示 4 个本科项目、3 条 CSCA 规则，截止日期为 2026 年 6 月 15 日。' }
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
