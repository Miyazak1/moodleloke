const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

const SOURCE_URL = 'https://iso.ruc.edu.cn/';
const VERIFIED_AT = new Date('2026-06-01T00:00:00.000Z');

const requirementText = [
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
].join('\n');

const scholarship = {
  slug: 'renmin-university-foreign-student-scholarship',
  title: '中国人民大学外国留学生奖学金',
  type: 'university',
  fundingLevel: 'partial',
  providerName: '中国人民大学',
  providerNameEn: 'Renmin University of China',
  providerLocation: 'Beijing, China',
  summary:
    '中国人民大学外国留学生奖学金面向在校非毕业年级学历生，设学习成绩奖、学习进步奖、社会活动奖、优秀干部奖，每学年评选一次。',
  coverage:
    '一次性奖励金：学习成绩奖一等奖 3000元/人、二等奖 2000元/人、三等奖 1000元/人；学习进步奖 1000元/人；社会活动奖 1000元/人；优秀干部奖 2000元/人。',
  applicableDegree: 'bachelor, master, doctoral',
  applicableProgram: '所有学历生项目。',
  amountText:
    '学习成绩奖：一等奖 3000元/人，二等奖 2000元/人，三等奖 1000元/人；学习进步奖 1000元/人；社会活动奖 1000元/人；优秀干部奖 2000元/人。',
  requirementText,
  bodySections: [
    {
      title: '奖学金内容',
      paragraphs: [
        '中国人民大学外国留学生奖学金设学习成绩奖、学习进步奖、社会活动奖、优秀干部奖等四项奖学金，重在鼓励和表彰在校留学生认真学习、积极参与各类活动、全面提升个人素质。',
        '该奖学金每学年评选一次，为一次性奖励金。'
      ],
      items: [
        '学习成绩奖一等奖：3000元/人。',
        '学习成绩奖二等奖：2000元/人。',
        '学习成绩奖三等奖：1000元/人。',
        '学习进步奖：1000元/人。',
        '社会活动奖：1000元/人。',
        '优秀干部奖：2000元/人。'
      ]
    },
    { title: '评选专业', paragraphs: ['所有学历生项目。'] },
    {
      title: '申请人资格',
      paragraphs: ['所有非毕业年级的在学学历生。'],
      items: [
        '一、二、三年级的本科生，一年级的硕士研究生（二年制），一、二级、二年级的硕士研究生（三年制），一年级的博士研究生。',
        '申请学习成绩奖学金的同学要求所提交成绩(GPA)在学院本年级留学生中排名前20%。',
        '无签证过期、无违反法律和学校校纪校规的不良记录。'
      ]
    },
    { title: '申请日期', paragraphs: ['每年4月初。'] },
    {
      title: '申请流程',
      items: [
        '符合条件的学生在规定时间内填写《中国人民大学外国留学生奖学金申请表》。',
        '学院审批奖学金申请资格。',
        '留学生办公室复审申请人资格，组织评审工作，公布获奖名单。'
      ]
    },
    {
      title: '申请材料',
      items: ['《中国人民大学外国留学生奖学金申请表》', '学生成绩单', '学院推荐意见。']
    },
    { title: '受理部门', paragraphs: ['国际交流处留学生办公室'] },
    { title: '联系方式', paragraphs: ['010-62512359，huangjunruc@163.com'] }
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
    { label: '学历层次', value: 'bachelor, master, doctoral' }
  ],
  applicationMaterials: [
    { label: '申请表', value: '《中国人民大学外国留学生奖学金申请表》' },
    { label: '成绩单', value: '学生成绩单' },
    { label: '推荐意见', value: '学院推荐意见' }
  ],
  applicationSteps: [
    { label: '第 1 步', value: '符合条件的学生在规定时间内填写申请表' },
    { label: '第 2 步', value: '学院审批奖学金申请资格' },
    { label: '第 3 步', value: '留学生办公室复审申请人资格，组织评审工作，公布获奖名单' }
  ],
  contactInfo: {
    label: '联系方式',
    email: 'huangjunruc@163.com',
    phone: '010-62512359',
    name: '国际交流处留学生办公室'
  },
  actionLinks: [
    { label: '查看大学详情', url: '/schools/renmin-university-of-china', kind: 'primary' },
    { label: '访问官网', url: SOURCE_URL, kind: 'source' },
    { label: 'CSCA 考试指南', url: '/csca-prep', kind: 'exam' },
    { label: '练习题', url: '/subjects', kind: 'exam' },
    { label: '申请时间线', url: '/study-in-china/timeline', kind: 'exam' }
  ],
  deadlineLabel: '每年4月初',
  applicationRound: '每年4月初申请',
  targetCountries: ['International students'],
  targetRegions: ['Global'],
  benefits: ['一次性奖励金'],
  sourceUrl: SOURCE_URL,
  sourceLabel: '中国人民大学国际学生办公室',
  lastVerifiedAt: VERIFIED_AT,
  sortOrder: 29,
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
  sortOrder: 2,
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
      update: { sortOrder: 2 },
      create: { scholarshipId: saved.id, schoolId: school.id, sortOrder: 2 }
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
