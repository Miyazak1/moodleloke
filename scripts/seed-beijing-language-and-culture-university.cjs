const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '北京语言大学',
  nameEn: 'Beijing Language and Culture University',
  schoolType: 'regular',
  region: 'Beijing, North China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '申请汉语汉语言本科专业的申请人如能提供有效期内 HSK 四级成绩报告，可免考专业中文。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学。',
  cscaRequirementNote: '申请汉语汉语言本科专业的申请人如能提供有效期内 HSK 四级成绩报告，可免考专业中文。',
  undergradRequirements: '截图显示北京语言大学本科项目按文科/人文类、理工科类和英文授课专业分别判断 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  applicationSteps: '先确认目标专业授课语言；中文授课按文科中文或理科中文搭配数学，英文授课项目按数学准备。',
  tuitionSummary: '¥26,000 - ¥32,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥26,000/年',
    englishPrograms: '¥32,000/年',
    livingCost: '约 ¥2,500/月',
    display: {
      city: 'Beijing',
      regionLabel: 'North China',
      livingCostLabel: '~¥2,500/月',
      displayProgramCount: 34,
      displayUndergraduateCount: 34,
      visibleProgramCount: 14,
      hiddenProgramNote: '还有20个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '数学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 4, visibleCount: 4 },
        { key: 'chinese_program', label: '汉语授课专业', total: 30, visibleCount: 10, hiddenNote: '还有20个汉语授课专业' }
      ],
      programFieldTags: [
        'language',
        'business',
        'education',
        'engineering',
        'science',
        'media',
        'politics'
      ],
      cscScholarship: {
        title: '中国政府奖学金 (CSC)',
        label: '全额资助',
        description: '中国规模最大的来华留学生奖学金资助项目，由国家留学基金委管理。'
      },
      scholarshipDisplayCount: 8
    }
  },
  accommodationCost: '生活费参考约 ¥2,500/月。',
  scholarships: [
    '2025年北京语言大学中国政府奖学金短期科研交流（China Link）项目',
    '2026年北京语言大学中国政府奖学金 “丝绸之路” 项目申请通知',
    '2026年北京语言大学中国政府奖学金国别双边项目（A类）招生简章',
    '2026年北京语言大学国际中文教师奖学金 “中文+” 奖本硕项目招生简章',
    '2026年春季本科及专科项目一览表'
  ],
  englishPrograms: '金融学（数智金融）、国际经济与贸易、会计学（数智会计）、汉字与中国学。',
  notablePrograms: '金融学（数智金融）、国际经济与贸易、会计学（数智会计）、汉字与中国学、汉语言-中日双语方向-北京奈良2+2项目、汉语言-汉语言+人工智能双学位（北语+北科联合培养）、汉语言-汉语方向、汉语言-汉英双语方向、汉语言-经贸方向、翻译-英汉翻译、翻译-韩汉翻译、翻译（本地化）、国际中文教育、国际经济与贸易。',
  programFields: 'language、business、education、engineering、science、media、politics。',
  source: 'csca-reference-screenshot',
  sourceId: 'beijing-language-and-culture-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const basePrograms = [
  ['金融学（数智金融）', 'Finance (Digital Finance)', 'business', '英文授课', ['数学'], 32000, '¥32,000/年', 1],
  ['国际经济与贸易', 'International Economics and Trade', 'business', '英文授课', ['数学'], 32000, '¥32,000/年', 2],
  ['会计学（数智会计）', 'Accounting (Digital Accounting)', 'business', '英文授课', ['数学'], 32000, '¥32,000/年', 3],
  ['汉字与中国学', 'Chinese Characters and Chinese Studies', 'language', '英文授课', ['数学'], 32000, '¥32,000/年', 4],
  ['汉语言 - 中日双语方向 - 北京奈良2+2项目', 'Chinese Language - China-Japan Bilingual Track - Beijing Nara 2+2 Program', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 5],
  ['汉语言 - 汉语言+人工智能双学位（北语+北科联合培养）', 'Chinese Language + Artificial Intelligence Dual Degree', 'language', '中文授课', ['中文(理科)', '数学', '物理'], 26000, '¥26,000/年', 6],
  ['汉语言 - 汉语方向', 'Chinese Language - Chinese Track', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 7],
  ['汉语言 - 汉英双语方向', 'Chinese Language - Chinese-English Bilingual Track', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 8],
  ['汉语言 - 经贸方向', 'Chinese Language - Economics and Trade Track', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 9],
  ['翻译 - 英汉翻译', 'Translation - English-Chinese Translation', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 10],
  ['翻译 - 韩汉翻译', 'Translation - Korean-Chinese Translation', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 11],
  ['翻译（本地化）', 'Translation (Localization)', 'language', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 12],
  ['国际中文教育', 'International Chinese Language Education', 'education', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 13],
  ['国际经济与贸易', 'International Economics and Trade', 'business', '中文授课', ['中文(文科)', '数学'], 26000, '¥26,000/年', 14]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears: '4',
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  hskRequirement: teachingLanguage === '英文授课' ? '英文授课专业按项目语言要求确认。' : '汉语汉语言相关本科专业如提供有效期内 HSK4 成绩报告，可免考专业中文。',
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  scholarshipText: '有奖学金',
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: '文科/人文类',
    category: 'humanities',
    scope: '中文授课文科/人文类专业',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '中文授课理工科类专业',
    cscaSubjects: ['中文(理科)', '数学'],
    description: '理科中文 + 数学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '汉语汉语言本科专业',
    cscaSubjects: [],
    languageCondition: '申请汉语汉语言本科专业的申请人如能提供有效期内 HSK 四级成绩报告，可免考专业中文。',
    description: '申请汉语汉语言本科专业的申请人如能提供有效期内 HSK 四级成绩报告，可免考专业中文。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '申请汉语汉语言本科专业的申请人如能提供有效期内 HSK 四级成绩报告，可免考专业中文。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

const scholarships = [
  ['2025年北京语言大学中国政府奖学金短期科研交流（China Link）项目', 'government', '全额资助', 1],
  ['2026年北京语言大学中国政府奖学金 “丝绸之路” 项目申请通知', 'government', '全额资助', 2],
  ['2026年北京语言大学中国政府奖学金国别双边项目（A类）招生简章', 'government', '全额资助', 3],
  ['2026年北京语言大学国际中文教师奖学金 “中文+” 奖本硕项目招生简章', 'government', '全额资助', 4],
  ['2026年春季本科及专科项目一览表', 'government', '政府奖学金', 5]
].map(([name, type, coverage, sortOrder]) => ({
  name,
  type,
  coverage,
  applicableDegree: '本科',
  applicableProgram: '北京语言大学国际学生项目',
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
    programs,
    cscaRules,
    scholarships,
    log: { note: '截图显示 34 个本科专业、8 项奖学金入口；本脚本录入截图可见 14 个专业和 5 项可见奖学金。' }
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
