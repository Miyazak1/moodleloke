const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '中国科学技术大学',
  nameEn: 'University of Science and Technology of China',
  schoolType: 'regular',
  region: 'Hefei, East China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  cscaRequired: true,
  cscaRequirement: '该大学的具体 CSCA 要求仍在确认中，请查看官方网站获取最新信息。',
  cscaRequirementNote: '请查阅学校官网获取最新考试要求。',
  undergradRequirements: '截图显示中国科学技术大学具体 CSCA 要求仍在确认中，必考科目待确认。',
  languageOfInstruction: ['Chinese'],
  applicationSteps: '先查看学校官网确认最新 CSCA 考试要求，再准备申请材料。',
  tuitionSummary: '待确认。',
  tuitionByCategory: {
    livingCost: '约 ¥1,300/月',
    display: {
      city: 'Hefei',
      regionLabel: 'East China',
      livingCostLabel: '~¥1,300/月',
      displaySubjectTags: ['待确认']
    }
  },
  accommodationCost: '生活费参考约 ¥1,300/月。',
  scholarships: [
    '中国科学技术大学 “中国科学院一带一路硕士奖学金”',
    '中国科学技术大学 “中国科学院与发展中国家科学院院长奖学金计划”',
    '中国科学技术大学留学生奖学金'
  ],
  englishPrograms: '',
  notablePrograms: '',
  programFields: '',
  source: 'csca-reference-screenshot',
  sourceId: 'university-of-science-and-technology-of-china',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const cscaRules = [
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '请查阅学校官网获取最新考试要求。',
    sortOrder: 1
  },
  {
    title: 'CSCA 要求确认中',
    category: 'notice',
    scope: '全部本科专业',
    cscaSubjects: [],
    description: '该大学的具体 CSCA 要求仍在确认中，请查看官方网站获取最新信息。',
    sortOrder: 2
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  {
    name: '中国科学技术大学 “中国科学院一带一路硕士奖学金”',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '硕士',
    applicableProgram: '中国科学技术大学国际学生项目',
    amountText: '以学校当年通知为准。',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 1
  },
  {
    name: '中国科学技术大学 “中国科学院与发展中国家科学院院长奖学金计划”',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '研究生',
    applicableProgram: '中国科学技术大学国际学生项目',
    amountText: '以学校当年通知为准。',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 2
  },
  {
    name: '中国科学技术大学留学生奖学金',
    type: 'university',
    coverage: '大学奖学金',
    applicableDegree: '本科',
    applicableProgram: '中国科学技术大学国际学生项目',
    amountText: '以学校当年通知为准。',
    requirementText: '大学奖学金，具体申请条件以学校当年说明为准。',
    sortOrder: 3
  }
].map((scholarship) => ({
  ...scholarship,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs: [],
    cscaRules,
    scholarships,
    log: { note: '截图显示中国科学技术大学 CSCA 要求与必考科目待确认；本脚本录入 2 条提示规则和 3 项奖学金。' }
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
