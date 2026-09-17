const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

const SOURCE_URL = 'https://iso.ruc.edu.cn/';
const VERIFIED_AT = new Date('2026-06-01T00:00:00.000Z');

const requirementText = [
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
].join('\n');

const scholarship = {
  slug: 'renmin-university-belt-and-road-scholarship',
  title: '中国人民大学国际学生“一带一路”奖学金',
  type: 'university',
  fundingLevel: 'partial',
  providerName: '中国人民大学',
  providerNameEn: 'Renmin University of China',
  providerLocation: 'Beijing, China',
  summary:
    '中国人民大学国际学生“一带一路”奖学金设立于2017年，面向“一带一路”沿线国家攻读学位项目的国际学生，优先覆盖全英文硕士项目。',
  coverage:
    '一次性奖励金：一等奖学金 8万/人；二等奖学金 4万/人；三等奖学金 2万/人。',
  applicableDegree: 'master',
  applicableProgram: '全英文硕士项目；如当年奖学金资助未用完，可扩大至其他学历项目的国际学生招生专业。',
  amountText: '一等奖学金：8万/人；二等奖学金：4万/人；三等奖学金：2万/人。',
  requirementText,
  bodySections: [
    {
      title: '奖学金内容',
      paragraphs: [
        '为做好我校国际学生的招生培养工作，吸引鼓励优秀国际学生来华学习，我校于2017年设立了中国人民大学国际学生“一带一路”奖学金。',
        '该奖学金为一次性奖励金，标准为：一等奖学金：8万/人；二等奖学金：4万/人；三等奖学金：2万/人。'
      ]
    },
    {
      title: '开放专业',
      paragraphs: ['全英文硕士项目，如当年奖学金资助未用完，可扩大至其他学历项目的国际学生招生专业。']
    },
    {
      title: '申请人资格',
      paragraphs: ['攻读学位项目的国际学生，国籍为“一带一路”沿线国家。']
    },
    {
      title: '申请日期',
      paragraphs: ['每年9月-10月。']
    },
    {
      title: '申请流程',
      items: [
        '符合条件的学生在规定时间内填写《中国人民大学国际学生“一带一路”奖学金申请表》，交由录取学院签署意见。',
        '各学院根据学生的申请材料、面试成绩进行综合评定，按照学院所获奖学金名额签署意见，明确推荐顺序并汇总提交获奖候选人名单。',
        '国际交流处对候选人材料进行审核，并公布最终获奖人名单。'
      ]
    },
    {
      title: '申请材料',
      items: ['《中国人民大学国际学生“一带一路”奖学金申请表》', '学院推荐意见。']
    },
    {
      title: '受理部门',
      paragraphs: ['国际交流处留学生办公室']
    },
    {
      title: '联系方式',
      paragraphs: ['010-62512698，fangruting_ruc@163.com']
    }
  ],
  benefitItems: [
    { key: 'tuition', label: '学费', included: false },
    { key: 'accommodation', label: '住宿费', included: false },
    { key: 'stipend', label: '生活费', included: false },
    { key: 'medical-insurance', label: '医疗保险', included: false },
    { key: 'flight', label: '机票', included: false },
    { key: 'settlement', label: '安置费', included: false }
  ],
  eligibilityItems: [
    { label: '学历层次', value: 'master' },
    { label: '目标国家/地区', value: '一带一路国家' }
  ],
  applicationMaterials: [
    { label: '申请表', value: '《中国人民大学国际学生“一带一路”奖学金申请表》' },
    { label: '推荐意见', value: '学院推荐意见' }
  ],
  applicationSteps: [
    { label: '第 1 步', value: '符合条件的学生在规定时间内填写申请表，交由录取学院签署意见' },
    { label: '第 2 步', value: '学院根据申请材料和面试成绩综合评定，明确推荐顺序并提交候选人名单' },
    { label: '第 3 步', value: '国际交流处审核候选人材料，并公布最终获奖人名单' }
  ],
  contactInfo: {
    label: '联系方式',
    email: 'fangruting_ruc@163.com',
    phone: '010-62512698',
    name: '国际交流处留学生办公室'
  },
  actionLinks: [
    { label: '查看大学详情', url: '/schools/renmin-university-of-china', kind: 'primary' },
    { label: '访问官网', url: SOURCE_URL, kind: 'source' },
    { label: 'CSCA 考试指南', url: '/csca-prep', kind: 'exam' },
    { label: '练习题', url: '/subjects', kind: 'exam' },
    { label: '申请时间线', url: '/study-in-china/timeline', kind: 'exam' }
  ],
  deadlineLabel: '每年9月-10月',
  applicationRound: '每年9月-10月申请',
  targetCountries: ['Belt and Road Countries'],
  targetRegions: ['Belt and Road'],
  benefits: ['一次性奖励金'],
  sourceUrl: SOURCE_URL,
  sourceLabel: '中国人民大学国际学生办公室',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 28,
  status: SchoolStatus.published
};

const schoolScholarship = {
  name: scholarship.title,
  type: scholarship.type,
  coverage: scholarship.coverage,
  applicableDegree: scholarship.applicableDegree,
  applicableProgram: scholarship.applicableProgram,
  amountText: scholarship.amountText,
  requirementText,
  sourceUrl: SOURCE_URL,
  sourceLabel: scholarship.sourceLabel,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 1,
  status: SchoolStatus.published
};

function scholarshipDataForSchool(school) {
  return school
    ? {
        ...scholarship,
        actionLinks: scholarship.actionLinks.map((link) => link.kind === 'primary' ? { ...link, url: `/schools/${school.id}` } : link)
      }
    : scholarship;
}

function scholarshipDuplicateUpdateData(data) {
  const { slug, ...rest } = data;
  return rest;
}

async function main() {
  const school = await prisma.school.findFirst({
    where: { OR: [{ nameZh: '中国人民大学' }, { nameEn: 'Renmin University of China' }, { sourceId: 'renmin-university-of-china' }] },
    select: { id: true, nameZh: true, nameEn: true }
  });
  const data = scholarshipDataForSchool(school);

  const existingScholarship = await prisma.scholarship.findFirst({
    where: { title: scholarship.title },
    orderBy: { id: 'asc' },
    select: { id: true, slug: true }
  });

  const saved = existingScholarship
    ? await prisma.scholarship.update({
        where: { id: existingScholarship.id },
        data: scholarshipDuplicateUpdateData(data),
        select: { id: true, slug: true, title: true, status: true }
      })
    : await prisma.scholarship.upsert({
        where: { slug: scholarship.slug },
        update: data,
        create: data,
        select: { id: true, slug: true, title: true, status: true }
      });

  if (school) {
    await prisma.scholarshipSchool.upsert({
      where: { scholarshipId_schoolId: { scholarshipId: saved.id, schoolId: school.id } },
      update: { sortOrder: 1 },
      create: { scholarshipId: saved.id, schoolId: school.id, sortOrder: 1 }
    });

    const existingSchoolScholarship = await prisma.schoolScholarship.findFirst({
      where: { schoolId: school.id, name: scholarship.title },
      select: { id: true }
    });
    if (existingSchoolScholarship) {
      await prisma.schoolScholarship.update({ where: { id: existingSchoolScholarship.id }, data: { ...schoolScholarship, schoolId: school.id } });
    } else {
      await prisma.schoolScholarship.create({ data: { ...schoolScholarship, schoolId: school.id } });
    }
  }

  await prisma.scholarship.deleteMany({
    where: { title: scholarship.title, id: { not: saved.id } }
  });

  console.log(JSON.stringify({ upserted: saved, linkedSchool: school }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
