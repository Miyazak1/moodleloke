const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }
}

loadEnv();

const prisma = new PrismaClient();
const source = 'reference-screenshot-demo';
const sourceId = 'ecnu-reference-demo-2026';
const verifiedAt = new Date('2026-05-08T00:00:00.000Z');

const programs = [
  ['Business Administration', 'Business Administration', 'Business Administration', '英文授课', ['数学'], 105000, 'CSCA：数学'],
  ['Double Degree Global BBA - Bachelor of Business Administration (Asia Europe Business School)', 'Double Degree Global BBA - Bachelor of Business Administration (Asia Europe Business School)', 'Business Administration', '英文授课', ['数学'], 105000, 'CSCA：数学'],
  ['Accounting', 'Accounting', 'Accounting', '中文授课', ['中文(文科)', '数学'], 24000, 'CSCA：中文(文科) + 数学'],
  ['Administration Management', 'Administration Management', 'Public Administration', '中文授课', ['中文(文科)', '数学'], 24000, 'CSCA：中文(文科) + 数学'],
  ['Applied Psychology', 'Applied Psychology', 'Psychology', '中文授课', ['中文(理科)', '数学'], 24000, 'CSCA：中文(理科) + 数学'],
  ['Biology Science', 'Biology Science', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 24000, 'CSCA：中文(理科) + 数学 + 化学'],
  ['Biology Technology', 'Biology Technology', 'Biology', '中文授课', ['中文(理科)', '数学', '化学'], 24000, 'CSCA：中文(理科) + 数学 + 化学'],
  ['Business Administration (Faculty of Economics and Management Asia Europe Business School)', 'Business Administration (Faculty of Economics and Management Asia Europe Business School)', 'Business Administration', '英文授课', ['数学'], 105000, 'CSCA：数学'],
  ['Business Administration (Faculty of Economics and Management School of Economics and Management)', 'Business Administration (Faculty of Economics and Management School of Economics and Management)', 'Business Administration', '中文授课', ['中文(文科)', '数学'], 24000, 'CSCA：中文(文科) + 数学'],
  ['Chemistry', 'Chemistry', 'Chemistry', '中文授课', ['中文(理科)', '数学', '化学'], 24000, 'CSCA：中文(理科) + 数学 + 化学'],
  ['Economics', 'Economics', 'Economics', '中文授课', ['中文(文科)', '数学'], 24000, 'CSCA：中文(文科) + 数学'],
  ['Environmental Science', 'Environmental Science', 'Environmental and Ecological Sciences', '中文授课', ['中文(理科)', '数学', '化学'], 24000, 'CSCA：中文(理科) + 数学 + 化学'],
  ['Ecology', 'Ecology', 'Environmental and Ecological Sciences', '中文授课', ['中文(理科)', '数学', '化学'], 24000, 'CSCA：中文(理科) + 数学 + 化学'],
  ['Fine Arts', 'Fine Arts', 'Fine Arts', '中文授课', ['中文(文科)'], 28000, 'CSCA：中文(文科)'],
  ['Geography', 'Geography', 'Geography', '中文授课', ['中文(理科)', '数学'], 24000, 'CSCA：中文(理科) + 数学'],
  ['History', 'History', 'History', '中文授课', ['中文(文科)'], 22000, 'CSCA：中文(文科)'],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 22000, 'CSCA：中文(文科) + 数学'],
  ['Musicology', 'Musicology', 'Music', '中文授课', ['中文(文科)'], 28000, 'CSCA：中文(文科)'],
  ['Philosophy', 'Philosophy', 'Philosophy and Psychology', '中文授课', ['中文(文科)'], 22000, 'CSCA：中文(文科)'],
  ['Physical Education', 'Physical Education', 'Physical Education', '中文授课', ['中文(文科)'], 22000, 'CSCA：中文(文科)'],
  ['Psychology', 'Psychology', 'Philosophy and Psychology', '中文授课', ['中文(理科)', '数学'], 24000, 'CSCA：中文(理科) + 数学'],
  ['Statistics', 'Statistics', 'Statistics', '中文授课', ['中文(理科)', '数学'], 24000, 'CSCA：中文(理科) + 数学'],
  ['Journalism and Media', 'Journalism and Media', 'Journalism and Media', '中文授课', ['中文(文科)'], 22000, 'CSCA：中文(文科)']
];

const deadlineNames = new Set(['Accounting', 'Administration Management', 'Applied Psychology', 'Biology Science', 'Biology Technology']);

const scholarships = [
  ['华东师范大学上海市政府奖学金', 'general', '全额或部分资助', '本科', '全校可申请专业'],
  ['华东师范大学中国政府奖学金自主招生项目', 'csc', 'CSC 奖学金，资助范围以当年通知为准', '本科/硕士/博士', '以 CSC 和学校当年项目清单为准'],
  ['华东师范大学优秀外国留学生奖学金', 'general', '部分资助', '本科', '成绩优秀申请者'],
  ['华东师范大学优秀外国留学生奖学金学生奖学金', 'general', '部分资助', '本科', '在读或新生申请者'],
  ['华东师范大学优秀本科新生奖学金', 'general', '部分资助', '本科', '本科新生'],
  ['国际中文教师奖学金', 'csc', '全额或部分资助', '本科/进修', '中文教育相关项目'],
  ['上海市外国留学生政府奖学金 A 类', 'general', '全额资助', '本科/硕士/博士', '以年度通知为准'],
  ['上海市外国留学生政府奖学金 B 类', 'general', '部分资助', '本科/硕士/博士', '以年度通知为准'],
  ['华东师范大学国际学生卓越奖', 'general', '部分资助', '本科', '优秀申请者'],
  ['学院专项奖学金', 'general', '部分资助', '本科', '以学院通知为准']
];

async function main() {
  const existing = await prisma.school.findMany({ where: { source, sourceId }, select: { id: true } });
  for (const item of existing) {
    await prisma.school.delete({ where: { id: item.id } });
  }

  const school = await prisma.school.create({
    data: {
      nameZh: '华东师范大学',
      nameEn: 'East China Normal University',
      rank: 12,
      schoolType: 'regular',
      region: 'Shanghai, East China',
      officialWebsite: 'https://www.ecnu.edu.cn/',
      applicationSystemUrl: 'https://lxs.ecnu.edu.cn/',
      admissionLevel: ['本科'],
      hskRequirement: '中文授课项目通常要求 HSK 4-5；英文授课项目以英语成绩或项目说明为准。',
      hskNotes: '截图样例显示 HSK 免考资格：国际汉语文化学院汉语言专业、仅需数学、英文授课设计等项目需按项目确认。',
      cscaRequirement: '文科人文类、理工科类和部分语言/免考规则并行，按专业方向确认 CSCA 科目。',
      cscaRequired: true,
      cscaRequirementNote: '文科类：中文(文科) + 数学；理工科类：中文(理科) + 数学 + 对应理化科目；英文授课项目多以数学为核心科目。',
      languageOfInstruction: ['中文授课', '英文授课'],
      hskEnglishRequired: true,
      englishRequired: true,
      englishRequirementNote: '英文授课项目需提交英语能力证明，具体以项目页面为准。',
      round1Deadline: '2026-06-15',
      round1OpenDate: '2026-01-15',
      round1CloseDate: '2026-06-15',
      applicationSteps: '先确认专业方向与授课语言，再核对 CSCA 科目、语言要求、截止日期和奖学金入口。',
      tuitionSummary: '¥22,000 - ¥105,000/年',
      tuitionByCategory: { undergraduate: '¥22,000 - ¥105,000/年', livingCost: '约 ¥2,500/月' },
      applicationFee: '约 ¥800',
      accommodationCost: '约 ¥2,500/月',
      scholarships: scholarships.map(([name]) => name),
      englishPrograms: 'Business Administration; Double Degree Global BBA; Business Administration (Asia Europe Business School)',
      notablePrograms: 'Accounting; Administration Management; Applied Psychology; Biology Science; Biology Technology; Chemistry; Economics; Environmental Science',
      programFields: 'Accounting; Biology; Business Administration; Chemistry; Economics; Environmental and Ecological Sciences; Journalism and Media; Law; Philosophy and Psychology; Physical Education',
      source,
      sourceId,
      sourceUrl: 'https://csca.app/zh/universities/east-china-normal-university',
      dataQualityScore: 92,
      lastVerifiedAt: verifiedAt,
      status: 'published'
    }
  });

  const rules = [
    ['文科人文类', '文科人文类', '文科、人文、法学、社科、艺术等本科项目', ['中文(文科)', '数学'], '中文授课按项目要求提交 HSK；英文授课项目按英语要求确认。', '截图样例显示文科人文类要求中文(文科)与数学，适用于外语、法学、人文、社科、管理、艺术等方向。', null],
    ['理工科类', '理工科类', '数学、计算机、物理、化学、生命科学、环境与生态等本科项目', ['中文(理科)', '数学', '物理', '化学'], '中文授课按 HSK 要求；英文授课项目按英语要求确认。', '截图样例显示理工科项目按方向组合中文(理科)、数学、物理、化学等科目。', null],
    ['HSK 免考资格', 'HSK 免考资格', '部分英文授课或特定学院项目', ['数学'], '国际汉语文化学院汉语言专业等项目以截图样例为准，是否免 HSK 需逐项确认。', '用于提示语言条件可能因专业而变化，不代表全校统一免 HSK。', null],
    ['重要提示', '重要提示', '全校申请', [], null, '截图样例中的要求用于申请判断演示，正式申请前应回到学校官方入口核验。', 'HSK 4-5 类要求需按专业页面和当年招生简章复核。']
  ];

  for (const [index, rule] of rules.entries()) {
    await prisma.$executeRawUnsafe(
      `insert into school_csca_rules
        (school_id, title, category, scope, csca_subjects, language_condition, description, important_note, source_url, source_label, last_verified_at, sort_order, status, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, 'published', now())`,
      school.id,
      rule[0],
      rule[1],
      rule[2],
      JSON.stringify(rule[3]),
      rule[4],
      rule[5],
      rule[6],
      'https://csca.app/zh/universities/east-china-normal-university',
      '参考站截图样例',
      verifiedAt,
      index + 1
    );
  }

  for (const [index, program] of programs.entries()) {
    const [nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, cscaRequirement] = program;
    await prisma.$executeRawUnsafe(
      `insert into school_programs
        (school_id, name_zh, name_en, degree_level, duration_years, field_category, teaching_language, csca_subjects, csca_requirement,
         hsk_requirement, english_requirement, tuition_amount, tuition_currency, tuition_period, tuition_text, scholarship_text,
         open_date, deadline_date, deadline_label, application_round, application_url, application_note, source_url, source_label,
         last_verified_at, sort_order, status, updated_at)
       values ($1, $2, $3, '本科', '4', $4, $5, $6::jsonb, $7, $8, $9, $10, 'RMB', 'year', $11, $12,
         $13, $14, $15, '2026 秋季本科', $16, $17, $18, $19, $20, $21, 'published', now())`,
      school.id,
      nameZh,
      nameEn,
      fieldCategory,
      teachingLanguage,
      JSON.stringify(cscaSubjects),
      cscaRequirement,
      teachingLanguage === '英文授课' ? '按英文授课项目要求确认，HSK 状态待项目核验。' : '中文授课项目通常需 HSK 4-5，按专业确认。',
      teachingLanguage === '英文授课' ? '需提交英语能力证明，具体以项目页面为准。' : null,
      tuitionAmount,
      `¥${Number(tuitionAmount).toLocaleString('en-US')}/年`,
      '可关注中国政府奖学金（CSC）、上海市政府奖学金和校级奖学金。',
      new Date('2026-01-15T00:00:00.000Z'),
      deadlineNames.has(nameZh) ? new Date('2026-06-15T00:00:00.000Z') : null,
      deadlineNames.has(nameZh) ? '2026 年 6 月 15 日' : '以项目页面为准',
      'https://lxs.ecnu.edu.cn/',
      '截图样例信息，正式申请前请以华东师范大学国际学生招生入口为准。',
      'https://csca.app/zh/universities/east-china-normal-university',
      '参考站截图样例',
      verifiedAt,
      index + 1
    );
  }

  for (const [index, scholarship] of scholarships.entries()) {
    const [name, type, coverage, applicableDegree, applicableProgram] = scholarship;
    await prisma.$executeRawUnsafe(
      `insert into school_scholarships
        (school_id, name, type, coverage, applicable_degree, applicable_program, amount_text, requirement_text, source_url, source_label, last_verified_at, sort_order, status, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'published', now())`,
      school.id,
      name,
      type,
      coverage,
      applicableDegree,
      applicableProgram,
      type === 'csc' ? '资助范围以 CSC 和学校当年通知为准。' : '奖学金金额和资助比例以学校当年通知为准。',
      '需满足学校国际学生申请要求，并按奖学金通知提交材料。',
      'https://csca.app/zh/universities/east-china-normal-university',
      '参考站截图样例',
      verifiedAt,
      index + 1
    );
  }

  const counts = await prisma.$queryRawUnsafe(
    `select
      (select count(*)::int from school_programs where school_id = $1) as programs,
      (select count(*)::int from school_csca_rules where school_id = $1) as "cscaRules",
      (select count(*)::int from school_scholarships where school_id = $1) as scholarships`,
    school.id
  );

  console.log(JSON.stringify({
    id: school.id,
    nameZh: school.nameZh,
    programs: counts[0].programs,
    cscaRules: counts[0].cscaRules,
    scholarships: counts[0].scholarships
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
