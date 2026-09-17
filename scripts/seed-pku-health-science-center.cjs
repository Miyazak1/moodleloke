const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'reference-page';
const APPLICATION_URL = 'http://www.bjmu.edu.cn/';
const VERIFIED_AT = new Date('2026-05-22T00:00:00.000Z');
const CSCA_SUBJECTS = ['中文(理科)', '数学', '化学', '物理'];

const schoolData = {
  nameZh: '北京大学医学部',
  nameEn: 'Peking University Health Science Center',
  rank: 33,
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: 'http://www.bjmu.edu.cn/',
  applicationSystemUrl: APPLICATION_URL,
  admissionLevel: ['本科'],
  hskRequirement: null,
  hskMinLevel: null,
  cscaRequired: true,
  cscaRequirement: '理科中文 + 数学(中文) + 物理(中文) + 化学中文。',
  cscaRequirementNote: '仅接受指定批次考试成绩。',
  undergradRequirements: '本科项目 4 个可选，授课语言为中文。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: null,
  round2Deadline: null,
  round1OpenDate: null,
  round1CloseDate: null,
  round2OpenDate: null,
  round2CloseDate: null,
  applicationSteps: '参考页面显示该校本科项目需按指定批次提交 CSCA 考试成绩。',
  tuitionSummary: '¥26,000 - ¥30,000/年。',
  tuitionByCategory: {
    humanities: '¥26,000/年',
    science: '¥30,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '约¥2,500/月',
      displayProgramCount: 4,
      displayUndergraduateCount: 4,
      visibleProgramCount: 4,
      displaySubjectTags: CSCA_SUBJECTS,
      programFieldTags: [
        'Economics',
        'Law',
        'Physics',
        'Business Administration',
        'Architecture',
        'Chemistry',
        'Environmental and Ecological Sciences',
        'Philosophy and Psychology',
        'Physical Education',
        'Biology'
      ]
    }
  },
  applicationFee: null,
  insurance: null,
  accommodationCost: '生活费约 ¥2,500/月。',
  accommodationType: null,
  scholarships: ['北京大学外国留学生奖学金'],
  notablePrograms: 'Law School(Humanities)；Law School(Science)；School of Economics(Science)；School of Physics(Science)。',
  campusFacilities: null,
  programFields: 'Economics；Law；Physics；Business Administration；Architecture；Chemistry；Environmental and Ecological Sciences；Philosophy and Psychology；Physical Education；Biology。',
  contactTel: null,
  contactEmail: null,
  contactAddress: null,
  source: 'reference-page',
  sourceId: 'pku-health-science-center-reference-page',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 90,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const programs = [
  {
    nameZh: 'Law School(Humanities)',
    nameEn: 'Law School(Humanities)',
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory: 'Law',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    cscaRequirement: 'CSCA：中文(文科) + 数学',
    tuitionAmount: 26000,
    tuitionText: '¥26,000/年',
    sortOrder: 1
  },
  {
    nameZh: 'Law School(Science)',
    nameEn: 'Law School(Science)',
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory: 'Law',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    cscaRequirement: 'CSCA：中文(文科) + 数学',
    tuitionAmount: 30000,
    tuitionText: '¥30,000/年',
    sortOrder: 2
  },
  {
    nameZh: 'School of Economics(Science)',
    nameEn: 'School of Economics(Science)',
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory: 'Economics',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    cscaRequirement: 'CSCA：中文(文科) + 数学',
    tuitionAmount: 30000,
    tuitionText: '¥30,000/年',
    sortOrder: 3
  },
  {
    nameZh: 'School of Physics(Science)',
    nameEn: 'School of Physics(Science)',
    degreeLevel: '本科',
    durationYears: '4',
    fieldCategory: 'Physics',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(理科)', '数学', '物理'],
    cscaRequirement: 'CSCA：中文(理科) + 数学 + 物理',
    tuitionAmount: 30000,
    tuitionText: '¥30,000/年',
    sortOrder: 4
  }
].map((program) => ({
  ...program,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  scholarshipText: '北京大学外国留学生奖学金。',
  applicationRound: '参考页面本科项目',
  applicationUrl: APPLICATION_URL,
  applicationNote: '仅接受指定批次考试成绩。',
  sourceUrl: SOURCE_URL,
  sourceLabel: '参考页面同步数据',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const cscaRules = [{
  title: '理工类 CSCA 要求',
  category: 'science',
  scope: '本科中文授课项目',
  cscaSubjects: CSCA_SUBJECTS,
  languageCondition: '中文授课。',
  description: '理科中文 + 数学(中文) + 物理(中文) + 化学中文。',
  importantNote: '仅接受指定批次考试成绩。',
  sourceUrl: SOURCE_URL,
  sourceLabel: '参考页面同步数据',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
}];

const scholarships = [{
  name: '北京大学外国留学生奖学金',
  type: 'university',
  coverage: '全额资助。',
  applicableDegree: '本科',
  applicableProgram: '本科项目',
  amountText: '全额资助。',
  requirementText: '大学奖学金。',
  sourceUrl: SOURCE_URL,
  sourceLabel: '参考页面同步数据',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
}];

async function main() {
  await runSchoolSeed({ schoolData, programs, cscaRules, scholarships });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
