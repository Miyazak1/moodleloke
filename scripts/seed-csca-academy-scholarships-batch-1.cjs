const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

const SCHOLARSHIPS = [
  {
    slug: 'belt-and-road-trade-union-cadres-chinese-language-training-scholarship',
    title: '“一带一路”沿线国家工会干部汉语研修奖学金申请指南',
    type: 'other',
    fundingLevel: 'full',
    summary:
      '为增进中国工会同各国工会组织的友好关系，增进中国工人阶级同各国工人阶级的友谊，为世界和平、发展、合作、工人权益和社会进步贡献力量，中华全国总工会设立面向“一带一路”沿线国家工会干部的汉语研修奖学金项目。项目培养形式为全日制汉语研修，学习期限为一学年（12个月），授课语言为汉语，项目院校为北京语言大学。',
    coverage:
      '奖学金为全额资助，包含学费、住宿费、生活费、综合医疗保险以及一次性往返国际旅费。学费、住宿费和综合医疗保险由相关单位统筹支付；生活费由学校按月发放；一次性往返国际旅费用于购买首次来华和学成回国的本国至学校所在地城市国际机票（经济舱）。',
    applicableDegree: 'language',
    applicableProgram: '汉语研修；一学年（12个月）；全日制；授课语言为汉语；项目院校为北京语言大学',
    amountText:
      '资助内容包括学费、住宿费、生活费、综合医疗保险和一次性往返国际旅费。截图页面列出项目相关金额：学费、住宿费、生活费、保险费及旅费等由奖学金覆盖，具体金额以官方页面和录取文件为准。',
    requirementText:
      [
        '申请条件：',
        '1. 非中国籍公民，来自“一带一路”沿线国家优先。',
        '2. 身心健康。',
        '3. 须具有高中毕业以上学历，年龄不超过45岁。',
        '4. 须具备一定工会工作经验；已有对华交流工作经历者优先。',
        '5. 未同时获得中国政府其他奖学金。',
        '',
        '申请材料：',
        '1. 《中国政府奖学金申请表》（中文或英文）。',
        '2. 经过公证的最高学历证明；中文以外文本须附经公证的中文或英文译文。',
        '3. 学习成绩单；中文以外文本须附经公证的中文或英文译文。',
        '4. 来华学习或研究计划（不少于500字，用中文或英文书写）。',
        '5. 年龄不满18周岁的申请人，须提交在华法定监护人的相关法律文件。',
        '6. 来华学习时间超过6个月的申请人，须提交《外国人体格检查表》扫描件，申请人应严格按照表中要求检查，缺项、未贴本人照片或照片上未盖骑缝章、无医师和医院签字盖章的表格无效，检查结果有效期为6个月。',
        '7. 个人简历，需体现申请人参与工会工作的经历；在校生和在职人员须提交相关证明材料。',
        '',
        '申请流程：申请人需在中国政府奖学金来华留学管理信息系统完成网上申请，填写申请信息并上传材料，下载申请表后按要求提交。具体受理、审核、录取和来华手续以官方通知及项目院校要求为准。'
      ].join('\n'),
    bodySections: [
      {
        title: '奖学金介绍',
        paragraphs: [
          '为增进中国工会同各国工会组织的友好关系，增进中国工人阶级同各国工人阶级的友谊，为世界和平、发展、合作、工人权益和社会进步贡献力量，中华全国总工会设立面向“一带一路”沿线国家工会干部的汉语研修奖学金项目。',
          '项目培养形式为全日制汉语研修，学习期限为一学年（12个月），授课语言为汉语，项目院校为北京语言大学。奖学金名额、受理时间和年度安排以官方通知为准。'
        ]
      },
      {
        title: '注意事项',
        items: [
          '奖学金生须按时来华注册，注册后由学校按月发放生活费。',
          '未按时报到、非因健康原因请假、休学或退学等情形，可能影响奖学金资格。',
          '申请人应确保申请材料真实、完整、有效，材料不完整或不符合要求可能不予受理。',
          '已获得中国政府其他奖学金资助者，原则上不可同时享受本项目资助。'
        ]
      },
      {
        title: '申请方式',
        paragraphs: [
          '申请人须通过中国政府奖学金来华留学管理信息系统完成网上申请，并根据项目要求提交申请表和相关材料。',
          '具体受理、审核、录取、签证和来华手续以官方通知及项目院校要求为准。'
        ]
      },
      {
        title: '来华签证',
        paragraphs: [
          '已获得录取和奖学金资格的申请人，应按录取材料要求办理来华学习签证。',
          '入境后注册、体检复查、居留许可等手续以学校和当地管理部门要求为准。'
        ]
      },
      {
        title: '报到注册、健康认证及居留许可',
        paragraphs: [
          '奖学金生须按照录取通知书规定时间到校报到注册。来华后应按学校要求完成健康认证、保险确认和居留许可办理。',
          '未能按期完成相关手续的，可能影响注册、奖学金发放或后续学习安排。'
        ]
      }
    ],
    benefitItems: [
      { key: 'tuition', label: '学费', included: true },
      { key: 'accommodation', label: '住宿费', included: true },
      { key: 'stipend', label: '生活费', included: true, note: '由学校按月发放，具体标准以官方通知为准。' },
      { key: 'medical-insurance', label: '综合医疗保险', included: true },
      { key: 'flight', label: '一次性往返国际旅费', included: true, note: '用于购买首次来华和学成回国的国际机票（经济舱）。' },
      { key: 'other', label: '其他费用', included: false, note: '未列明费用以官方页面及录取文件为准。' }
    ],
    eligibilityItems: [
      { label: '学历层次', value: 'language' },
      { label: '年龄限制', value: '≤45 岁' },
      { label: '目标国家/地区', value: '“一带一路”沿线国家优先' },
      { label: '身份要求', value: '非中国籍公民，身心健康' },
      { label: '工作经历', value: '须具备一定工会工作经验；已有对华交流经历者优先' },
      { label: '奖学金限制', value: '未同时获得中国政府其他奖学金' }
    ],
    applicationMaterials: [
      { label: '申请表', value: '《中国政府奖学金申请表》（中文或英文）' },
      { label: '学历证明', value: '经过公证的最高学历证明；非中文材料需附中文或英文译文' },
      { label: '成绩单', value: '学习成绩单；非中文材料需附中文或英文译文' },
      { label: '学习计划', value: '来华学习或研究计划，不少于500字，用中文或英文书写' },
      { label: '监护材料', value: '年龄不满18周岁的申请人须提交在华法定监护人相关法律文件' },
      { label: '体检表', value: '来华学习时间超过6个月者须提交《外国人体格检查表》扫描件' },
      { label: '个人简历', value: '须体现申请人参与工会工作的经历；在校生和在职人员须提交相关证明' }
    ],
    applicationSteps: [
      { label: '第 1 步', value: '登录中国政府奖学金来华留学管理信息系统完成网上申请' },
      { label: '第 2 步', value: '填写申请信息，选择对应项目类别并上传申请材料' },
      { label: '第 3 步', value: '下载并提交申请表，按官方通知完成后续受理和审核' },
      { label: '第 4 步', value: '获得录取后按学校要求办理签证、报到注册及入学手续' }
    ],
    contactInfo: {
      label: '联系方式',
      website: 'http://www.csc.edu.cn/studychina',
      note: '具体联系方式以官方奖学金页面及年度通知为准。'
    },
    actionLinks: [
      { label: '前往申请', url: 'http://www.csc.edu.cn/studychina', kind: 'primary' },
      { label: '查看官方来源', url: 'http://www.csc.edu.cn/studychina', kind: 'source' }
    ],
    deadlineLabel: '以官方年度通知为准',
    applicationRound: '2026 年度申请',
    targetCountries: ['Belt and Road Countries'],
    targetRegions: ['Belt and Road'],
    benefits: ['学费', '住宿费', '生活费', '综合医疗保险', '一次性往返国际旅费'],
    sourceUrl: 'http://www.csc.edu.cn/studychina',
    sourceLabel: '中国政府奖学金来华留学管理信息系统 / Campus China',
    lastVerifiedAt: '2026-05-28',
    sortOrder: 1,
    status: SchoolStatus.published
  },
  {
    slug: 'three-gorges-university-full-scholarship-for-myanmar-students',
    title: '三峡大学全额奖学金（缅甸籍学生）',
    type: 'university',
    fundingLevel: 'full',
    providerName: '三峡大学',
    providerNameEn: 'China Three Gorges University',
    providerLocation: 'Yichang, Hubei, China',
    summary:
      '该奖学金由三峡大学校友、云南云能电力工程公司董事长王俊昌捐赠，用于资助优秀的缅甸籍学生来校学习，旨在推动缅甸项目在相关领域的人才培养，提升三峡大学国际影响力。',
    coverage:
      '奖学金为全额资助，资助项目包括学费、住宿费、保险费、注册费，以及每月 2500 元生活费。',
    applicableDegree: 'bachelor',
    applicableProgram: '水利水电工程、土木工程、电气工程及其自动化、自动化、计算机科学与技术、工商管理',
    amountText: '学费、住宿费、保险费、注册费，以及每月 2500 元生活费。奖学金名额：10 名。',
    requirementText:
      [
        '申请人资格：',
        '1. 18-25 岁的缅甸籍公民。',
        '2. 对华友好，身心健康，学习努力及成绩优异。',
        '3. 高中毕业。',
        '4. 具备良好的英语听说读写能力。',
        '5. 具有一定汉语基础者优先考虑。',
        '',
        '申请材料：',
        '1. 在线打印三峡大学外国留学生入学申请表后本人签字。',
        '2. 护照复印件（有效期内的普通护照）。',
        '3. 如申请人在中国，需提交签证和居留证件复印件。',
        '4. 高中毕业证；中英文以外文本须附经公证的英文或中文翻译件。',
        '5. 成绩单；中英文以外文本须附经公证的英文或中文翻译件。',
        '6. 外国人体格检查表。',
        '7. 银行存款证明或经济担保函。',
        '8. 5 分钟英文个人介绍视频。',
        '9. 王俊昌校友的推荐信。'
      ].join('\n'),
    bodySections: [
      {
        title: '奖学金介绍',
        paragraphs: [
          '该奖学金由三峡大学校友、云南云能电力工程公司董事长王俊昌捐赠，用于资助优秀的缅甸籍学生来校学习，旨在推动缅甸项目在相关领域的人才培养，提升三峡大学国际影响力。'
        ]
      },
      {
        title: '奖学金资助项目',
        items: ['学费', '住宿费', '保险费', '注册费', '每月 2500 元生活费']
      },
      {
        title: '2018-2019 学年奖学金专业目录（本科）',
        items: ['水利水电工程', '土木工程', '电气工程及其自动化', '自动化', '计算机科学与技术', '工商管理']
      },
      {
        title: '奖学金名额',
        paragraphs: ['10 名。']
      },
      {
        title: '申请人资格',
        items: [
          '18-25 岁的缅甸籍公民。',
          '对华友好，身心健康，学习努力及成绩优异。',
          '高中毕业。',
          '具备良好的英语听说读写能力。',
          '具有一定汉语基础者优先考虑。'
        ]
      },
      {
        title: '申请材料',
        items: [
          '在线打印三峡大学外国留学生入学申请表后本人签字。',
          '护照复印件（有效期内的普通护照）。',
          '如申请人在中国，需提交签证和居留证件复印件。',
          '高中毕业证；中英文以外文本须附经公证的英文或中文翻译件。',
          '成绩单；中英文以外文本须附经公证的英文或中文翻译件。',
          '外国人体格检查表。',
          '银行存款证明或经济担保函。',
          '5 分钟英文个人介绍视频。',
          '王俊昌校友的推荐信。'
        ]
      },
      {
        title: '网上申请与截止日期',
        paragraphs: ['网上申请链接：http://lsx.ctgu.edu.cn/。', '申请截止日期：2018 年 7 月 15 日。']
      }
    ],
    benefitItems: [
      { key: 'tuition', label: '学费', included: true },
      { key: 'accommodation', label: '住宿费', included: true },
      { key: 'stipend', label: '生活费', included: true, note: '每月 2500 元。' },
      { key: 'medical-insurance', label: '保险费', included: true },
      { key: 'registration', label: '注册费', included: true },
      { key: 'flight', label: '机票', included: false },
      { key: 'other', label: '签证费', included: false }
    ],
    eligibilityItems: [
      { label: '学历层次', value: 'bachelor' },
      { label: '年龄限制', value: '18-25 岁' },
      { label: '目标国家/地区', value: 'Myanmar' },
      { label: '学历要求', value: '高中毕业' },
      { label: '语言能力', value: '具备良好的英语听说读写能力；有汉语基础者优先' }
    ],
    applicationMaterials: [
      { label: '申请表', value: '在线打印三峡大学外国留学生入学申请表后本人签字' },
      { label: '护照', value: '有效期内普通护照复印件' },
      { label: '在华材料', value: '如申请人在中国，需提交签证和居留证件复印件' },
      { label: '毕业证', value: '高中毕业证；中英文以外文本须附经公证的英文或中文翻译件' },
      { label: '成绩单', value: '中英文以外文本须附经公证的英文或中文翻译件' },
      { label: '体检表', value: '外国人体格检查表' },
      { label: '经济证明', value: '银行存款证明或经济担保函' },
      { label: '视频', value: '5 分钟英文个人介绍视频' },
      { label: '推荐信', value: '王俊昌校友的推荐信' }
    ],
    applicationSteps: [
      { label: '第 1 步', value: '访问三峡大学国际学生网上申请系统并填写申请信息' },
      { label: '第 2 步', value: '上传申请表、护照、学历证明、成绩单、体检表等材料' },
      { label: '第 3 步', value: '提交英文个人介绍视频及推荐信' },
      { label: '第 4 步', value: '按学校通知完成审核、录取及报到手续' }
    ],
    contactInfo: {
      label: '联系方式',
      name: '王艳 / 肖平',
      email: 'hxlameila@163.com；xiong1212@ctgu.edu.cn',
      phone: '+86 13987637390；+86 717 6394999',
      website: 'http://eng.ctgu.edu.cn/',
      note: '传真：+86 717 6393309。具体联系方式以学校官方页面为准。'
    },
    actionLinks: [
      { label: '前往申请', url: 'http://lsx.ctgu.edu.cn/', kind: 'primary' },
      { label: '查看大学详情', url: 'http://eng.ctgu.edu.cn/', kind: 'secondary' },
      { label: '查看官方来源', url: 'http://eng.ctgu.edu.cn/', kind: 'source' }
    ],
    deadlineDate: '2018-07-15',
    deadlineLabel: '2018 年 7 月 15 日',
    applicationRound: '2018-2019 学年',
    targetCountries: ['Myanmar'],
    targetRegions: ['Southeast Asia'],
    benefits: ['学费', '住宿费', '生活费', '保险费', '注册费'],
    sourceUrl: 'http://eng.ctgu.edu.cn/',
    sourceLabel: '三峡大学国际学生招生页面',
    lastVerifiedAt: '2026-05-28',
    sortOrder: 2,
    status: SchoolStatus.archived
  }
];

async function upsertScholarship(item) {
  const data = {
    title: item.title,
    type: item.type,
    fundingLevel: item.fundingLevel,
    providerName: item.providerName,
    providerNameEn: item.providerNameEn,
    providerLocation: item.providerLocation,
    summary: item.summary,
    coverage: item.coverage,
    applicableDegree: item.applicableDegree,
    applicableProgram: item.applicableProgram,
    amountText: item.amountText,
    requirementText: item.requirementText,
    bodySections: item.bodySections,
    benefitItems: item.benefitItems,
    eligibilityItems: item.eligibilityItems,
    applicationMaterials: item.applicationMaterials,
    applicationSteps: item.applicationSteps,
    contactInfo: item.contactInfo,
    actionLinks: item.actionLinks,
    deadlineDate: item.deadlineDate ? new Date(`${item.deadlineDate}T00:00:00.000Z`) : null,
    deadlineLabel: item.deadlineLabel,
    applicationRound: item.applicationRound,
    targetCountries: item.targetCountries,
    targetRegions: item.targetRegions,
    benefits: item.benefits,
    sourceUrl: item.sourceUrl,
    sourceLabel: item.sourceLabel,
    lastVerifiedAt: new Date(`${item.lastVerifiedAt}T00:00:00.000Z`),
    sortOrder: item.sortOrder,
    status: item.status
  };

  return prisma.scholarship.upsert({
    where: { slug: item.slug },
    update: data,
    create: {
      slug: item.slug,
      ...data
    },
    select: { id: true, slug: true, title: true }
  });
}

async function main() {
  const result = { upserted: 0, items: [] };
  for (const item of SCHOLARSHIPS) {
    const saved = await upsertScholarship(item);
    result.upserted += 1;
    result.items.push(saved);
  }
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
