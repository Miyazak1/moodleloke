const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const SOURCE_URL = 'https://csca.app/zh/universities/renmin-university-of-china';
const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');

const schoolData = {
  nameZh: '中国人民大学',
  nameEn: 'Renmin University of China',
  rank: 34,
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: 'https://www.ruc.edu.cn/',
  applicationSystemUrl: 'https://iso.ruc.edu.cn/',
  admissionLevel: ['本科'],
  hskRequirement: '汉语言专业：HSK4 可免文科中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学。',
  cscaRequirementNote: '文科专业全部为文科中文 + 数学；心理学、大数据管理与应用按理科中文 + 数学判断。',
  undergradRequirements: '截图参考页显示该校本科项目涉及中文授课与英文授课路径，其中 Global BBA 为英文授课项目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: 'Global BBA：2026 年 5 月 31 日。',
  round1CloseDate: '2026-05-31',
  applicationSteps: '先按目标专业确认授课语言、CSCA 科目和 HSK 免考条件，再进入对应申请入口。',
  tuitionSummary: '¥24,000 - ¥36,000/年。',
  tuitionByCategory: {
    chineseHumanities: '¥24,000 - ¥26,000/年',
    globalBba: '¥36,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 7,
      displayUndergraduateCount: 7,
      visibleProgramCount: 7,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)'],
      programFieldTags: ['Business Administration', 'Economics', 'Law']
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: ['中国人民大学国际学生“一带一路”奖学金', '中国人民大学外国留学生奖学金'],
  englishPrograms: 'Global BBA。',
  notablePrograms: 'Global BBA、Accounting、Archives Science、Economics、Human Resource Management、International Economics and Trade、Law。',
  programFields: 'Business Administration、Economics、Law。',
  source: 'csca-reference-screenshot',
  sourceId: 'renmin-university-of-china',
  sourceUrl: SOURCE_URL,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const programs = [
  {
    nameZh: 'Global BBA',
    nameEn: 'Global BBA',
    fieldCategory: 'Business Administration',
    teachingLanguage: '英文授课',
    cscaSubjects: ['数学'],
    tuitionAmount: 36000,
    tuitionText: '¥36,000/年',
    deadlineDate: new Date('2026-05-31T00:00:00.000Z'),
    deadlineLabel: 'May 31, 2026',
    applicationRound: '2026 Global BBA',
    sortOrder: 1
  },
  {
    nameZh: 'Accounting',
    nameEn: 'Accounting',
    fieldCategory: 'Business Administration',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    tuitionAmount: 26000,
    tuitionText: '¥26,000/年',
    sortOrder: 2
  },
  {
    nameZh: 'Archives Science',
    nameEn: 'Archives Science',
    fieldCategory: 'Archives Science',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    tuitionAmount: 24000,
    tuitionText: '¥24,000/年',
    sortOrder: 3
  },
  {
    nameZh: 'Economics',
    nameEn: 'Economics',
    fieldCategory: 'Economics',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    tuitionAmount: 26000,
    tuitionText: '¥26,000/年',
    sortOrder: 4
  },
  {
    nameZh: 'Human Resource Management',
    nameEn: 'Human Resource Management',
    fieldCategory: 'Business Administration',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    tuitionAmount: 26000,
    tuitionText: '¥26,000/年',
    sortOrder: 5
  },
  {
    nameZh: 'International Economics and Trade',
    nameEn: 'International Economics and Trade',
    fieldCategory: 'Economics',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    tuitionAmount: 26000,
    tuitionText: '¥26,000/年',
    sortOrder: 6
  },
  {
    nameZh: 'Law',
    nameEn: 'Law',
    fieldCategory: 'Law',
    teachingLanguage: '中文授课',
    cscaSubjects: ['中文(文科)', '数学'],
    tuitionAmount: 26000,
    tuitionText: '¥26,000/年',
    sortOrder: 7
  }
].map((program) => ({
  ...program,
  degreeLevel: '本科',
  durationYears: '4',
  cscaRequirement: `CSCA：${program.cscaSubjects.join(' + ')}`,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '文科、人文社科、经管、法学等中文授课本科项目',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科专业全部为文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '心理学、大数据管理与应用等理工方向',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '心理学、大数据管理与应用按理科中文 + 数学判断。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语言专业',
    cscaSubjects: ['中文(文科)', '数学'],
    languageCondition: '汉语言专业：HSK4 可免文科中文。',
    description: '申请汉语言专业且符合 HSK4 条件时，可免考文科中文。',
    sortOrder: 3
  }
].map((rule) => ({
  ...rule,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  {
    name: '中国人民大学国际学生“一带一路”奖学金',
    type: 'university',
    coverage: '一次性奖励金：一等奖学金 8万/人；二等奖学金 4万/人；三等奖学金 2万/人。',
    applicableDegree: 'master',
    applicableProgram: '全英文硕士项目；如当年奖学金资助未用完，可扩大至其他学历项目的国际学生招生专业。',
    amountText: '一等奖学金：8万/人；二等奖学金：4万/人；三等奖学金：2万/人。',
    requirementText: [
      '一、奖学金内容',
      '为做好我校国际学生的招生培养工作，吸引鼓励优秀国际学生来华学习，我校于2017年设立了中国人民大学国际学生“一带一路”奖学金。',
      '该奖学金为一次性奖励金，标准为：一等奖学金：8万/人；二等奖学金：4万/人；三等奖学金：2万/人。',
      '',
      '二、开放专业',
      '全英文硕士项目，如当年奖学金资助未用完，可扩大至其他学历项目的国际学生招生专业。',
      '',
      '三、申请人资格',
      '攻读学位项目的国际学生，国籍为“一带一路”沿线国家。',
      '',
      '四、申请日期',
      '每年9月-10月。',
      '',
      '五、申请流程',
      '1.符合条件的学生在规定时间内填写《中国人民大学国际学生“一带一路”奖学金申请表》，交由录取学院签署意见；',
      '2.各学院根据学生的申请材料、面试成绩进行综合评定，按照学院所获奖学金名额签署意见，明确推荐顺序并汇总提交获奖候选人名单；',
      '3.国际交流处对候选人材料进行审核，并公布最终获奖人名单。',
      '',
      '六、申请材料',
      '1.《中国人民大学国际学生“一带一路”奖学金申请表》；',
      '2.学院推荐意见。',
      '',
      '七、受理部门',
      '国际交流处留学生办公室',
      '',
      '八、联系方式',
      '010-62512698，fangruting_ruc@163.com'
    ].join('\n'),
    sortOrder: 1
  },
  {
    name: '中国人民大学外国留学生奖学金',
    type: 'university',
    coverage: '一次性奖励金：学习成绩奖一等奖 3000元/人、二等奖 2000元/人、三等奖 1000元/人；学习进步奖 1000元/人；社会活动奖 1000元/人；优秀干部奖 2000元/人。',
    applicableDegree: 'bachelor, master, doctoral',
    applicableProgram: '所有学历生项目。',
    amountText: '学习成绩奖：一等奖 3000元/人，二等奖 2000元/人，三等奖 1000元/人；学习进步奖 1000元/人；社会活动奖 1000元/人；优秀干部奖 2000元/人。',
    requirementText: [
      '一、奖学金内容',
      '中国人民大学外国留学生奖学金设学习成绩奖、学习进步奖、社会活动奖、优秀干部奖等四项奖学金，重在鼓励和表彰在校留学生认真学习、积极参与各类活动、全面提升个人素质。该奖学金每学年评选一次，为一次性奖励金。',
      '学习成绩奖标准：',
      '一等奖学金：3000元/人；',
      '二等奖学金：2000元/人；',
      '三等奖学金：1000元/人；',
      '学习进步奖标准：1000元/人；',
      '社会活动奖标准：1000元/人；',
      '优秀干部奖标准：2000元/人。',
      '',
      '二、评选专业',
      '所有学历生项目。',
      '',
      '三、申请人资格',
      '所有非毕业年级的在学学历生。',
      '1.一、二、三年级的本科生，一年级的硕士研究生（二年制），一、二级、二年级的硕士研究生（三年制），一年级的博士研究生；',
      '2.申请学习成绩奖学金的同学要求所提交成绩(GPA)在学院本年级留学生中排名前20%；',
      '3.无签证过期、无违反法律和学校校纪校规的不良记录。',
      '',
      '四、申请日期',
      '每年4月初。',
      '',
      '五、申请流程',
      '1.符合条件的学生在规定时间内填写《中国人民大学外国留学生奖学金申请表》；',
      '2.学院审批奖学金申请资格；',
      '3.留学生办公室复审申请人资格，组织评审工作，公布获奖名单。',
      '',
      '六、申请材料',
      '1.《中国人民大学外国留学生奖学金申请表》；',
      '2.学生成绩单；',
      '3.学院推荐意见。',
      '',
      '七、受理部门',
      '国际交流处留学生办公室',
      '',
      '八、联系方式',
      '010-62512359，huangjunruc@163.com'
    ].join('\n'),
    sortOrder: 2
  }
].map((scholarship) => ({
  ...scholarship,
  sourceUrl: SOURCE_URL,
  sourceLabel: 'CSCA Academy 参考页',
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

async function syncSequences() {
  const tables = ['schools', 'school_programs', 'school_csca_rules', 'school_scholarships'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`
    );
  }
}

async function upsertSchool() {
  const existing = await prisma.school.findFirst({
    where: {
      OR: [{ source: schoolData.source, sourceId: schoolData.sourceId }, { nameZh: schoolData.nameZh }]
    }
  });

  if (existing) {
    return prisma.school.update({ where: { id: existing.id }, data: schoolData });
  }

  return prisma.school.create({ data: schoolData });
}

async function replaceChildren(schoolId) {
  await prisma.schoolProgram.deleteMany({ where: { schoolId } });
  await prisma.schoolCscaRule.deleteMany({ where: { schoolId } });
  await prisma.schoolScholarship.deleteMany({ where: { schoolId } });

  await prisma.schoolProgram.createMany({ data: programs.map((program) => ({ ...program, schoolId })) });
  await prisma.schoolCscaRule.createMany({ data: cscaRules.map((rule) => ({ ...rule, schoolId })) });
  await prisma.schoolScholarship.createMany({ data: scholarships.map((scholarship) => ({ ...scholarship, schoolId })) });
}

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
