const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/xiangtan-university';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '湘潭大学',
  nameEn: 'Xiangtan University',
  rank: 47,
  schoolType: 'regular',
  region: 'Xiangtan, Central China',
  officialWebsite: 'https://www.xtu.edu.cn/',
  applicationSystemUrl: 'https://sie.xtu.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '汉语言文学专业：仅需数学。',
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学 + 物理 + 化学。',
  cscaRequirementNote: '所有理工科都需要四门科目。',
  undergradRequirements: '截图参考页显示湘潭大学本科项目按文科/人文类、理工科类和 HSK 免考政策判断 CSCA 科目。',
  languageOfInstruction: ['Chinese'],
  applicationSteps: '先确认目标专业所属文科或理工方向；理工科按四门科目准备。',
  tuitionByCategory: {
    livingCost: '约 ¥1,000/月',
    display: {
      city: 'Xiangtan',
      regionLabel: 'Central China',
      livingCostLabel: '~¥1,000/月',
      displaySubjectTags: ['数学', '化学', '物理', '中文(文科)', '中文(理科)'],
      programFieldTags: []
    }
  },
  accommodationCost: '生活费参考约 ¥1,000/月。',
  scholarships: ['湘潭大学优秀国际学生奖学金'],
  source: 'csca-reference-screenshot',
  sourceId: 'xiangtan-university',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 95,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '哲学、历史、社会学、商学、公共管理、法学、马克思主义、文学新闻、艺术等方向',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。哲学、历史、社会学、商学、公共管理、法学、马克思主义、文学新闻、艺术等方向适用。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '数学、物理、化学、材料、化工、环境、机械、自动化、电子信息、计算机、土木等方向',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学 + 物理 + 化学。所有理工科都需要四门科目。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言文学',
    cscaSubjects: [],
    languageCondition: '汉语言文学专业：仅需数学。',
    description: '汉语言文学专业按截图参考页显示仅需数学。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '理工科',
    cscaSubjects: [],
    description: '所有理工科都需要四门科目。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [{
  name: '湘潭大学优秀国际学生奖学金',
  type: 'university',
  applicableDegree: '本科',
  applicableProgram: '湘潭大学国际学生项目',
  requirementText: '大学奖学金，具体申请条件以学校当年通知为准。',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
}];

async function main() {
  await runSchoolSeed({
    schoolData,
    cscaRules,
    scholarships,
    log: { note: '截图未展示专业清单；本脚本录入截图可见 CSCA 要求、生活费和奖学金。' }
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
