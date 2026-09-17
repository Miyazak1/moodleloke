const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京大学',
  nameEn: 'Peking University',
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理，化学至少选考一门。',
  cscaRequirementNote: '中国政府奖学金申请人须参加 CSCA 测试。',
  undergradRequirements: '截图显示北京大学本部当前可选专业为 0；中国政府奖学金申请人须参加 CSCA 测试。',
  languageOfInstruction: ['Chinese'],
  applicationSteps: '按截图显示的文理科组合准备 CSCA；中国政府奖学金申请人须参加 CSCA 测试。',
  tuitionSummary: '待确认。',
  tuitionByCategory: {
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 0,
      displayUndergraduateCount: 0,
      visibleProgramCount: 0,
      displaySubjectTags: ['中文(理科)', '数学', '物理', '化学'],
      programDisplayGroups: [],
      cscScholarship: {
        title: '中国政府奖学金 (CSC)',
        label: '全额资助',
        description: '中国规模最大的来华留学生奖学金资助项目，由国家留学基金委管理。'
      },
      scholarshipDisplayCount: 11
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [
    '2024年北京大学国际中文教师奖学金汉语国际教育专业硕士研究生项目',
    '2024年北京大学国际中文教师奖学金项目申请通知——普通进修/预科',
    '2026年北京大学外国留学生本科生免笔试招生简章',
    '2026年北京大学外国留学生本科生入学考试招生简章',
    '中国政府奖学金 “高水平研究生” 项目'
  ],
  englishPrograms: '',
  notablePrograms: '',
  programFields: '',
  source: 'csca-reference-screenshot',
  sourceId: 'peking-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '文科/人文类申请方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工科类申请方向',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理；化学至少选考一门。',
    sortOrder: 2
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '中国政府奖学金申请人',
    cscaSubjects: [],
    description: '中国政府奖学金申请人须参加 CSCA 测试。',
    sortOrder: 3
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  ['2024年北京大学国际中文教师奖学金汉语国际教育专业硕士研究生项目', 'confucius', '全额资助', '硕士', 1],
  ['2024年北京大学国际中文教师奖学金项目申请通知——普通进修/预科', 'confucius', '全额资助', '进修/预科', 2],
  ['2026年北京大学外国留学生本科生免笔试招生简章', 'government', '全额资助', '本科', 3],
  ['2026年北京大学外国留学生本科生入学考试招生简章', 'government', '全额资助', '本科', 4],
  ['中国政府奖学金 “高水平研究生” 项目', 'government', '全额资助', '研究生', 5]
].map(([name, type, coverage, applicableDegree, sortOrder]) => ({
  name,
  type,
  coverage,
  applicableDegree,
  applicableProgram: '北京大学国际学生项目',
  amountText: '以奖学金说明为准。',
  requirementText: '截图中可见奖学金条目，具体申请条件以学校当年说明为准。',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs: [],
    cscaRules,
    scholarships,
    log: { note: '截图显示北京大学当前可选专业为 0，奖学金入口共 11 项；本脚本录入截图可见 5 项奖学金。' }
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
