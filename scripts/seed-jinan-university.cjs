const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '暨南大学',
  nameEn: 'Jinan University',
  schoolType: 'regular',
  region: 'Guangzhou, South China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: '马来西亚 UEC 学生免 HSK；STPM 学生需 HSK5 级（180 分）以上；国际学院英语授课专业需雅思 5.5 或托福 80。',
  hskMinLevel: 5,
  cscaRequired: true,
  cscaRequirement: '文科/人文类：文科中文 + 数学；理工科类：理科中文 + 数学，部分专业仅需数学，或需数学 + 物理/化学。',
  cscaRequirementNote: '双一流高校；华侨最高学府；广州、深圳、珠海校区；接受马来西亚 UEC、STPM、SPM 成绩申请；部分专业仅需数学成绩。',
  undergradRequirements: '截图显示暨南大学本科项目包含 5 个英文授课项目和多个中文授课项目，按文科/理工科及授课语言匹配 CSCA 科目。',
  languageOfInstruction: ['Chinese', 'English'],
  round1Deadline: '部分中文授课项目截止：2026 年 5 月 31 日。',
  round1CloseDate: '2026-05-31',
  applicationSteps: '按校区和授课语言确认项目；国际学院英语授课专业需满足英语成绩要求，马来西亚 UEC/STPM/SPM 申请按截图提示处理。',
  tuitionSummary: '¥19,000 - ¥40,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥19,000 - ¥22,000/年',
    englishPrograms: '¥25,000 - ¥40,000/年',
    livingCost: '约 ¥2,200/月',
    display: {
      city: 'Guangzhou',
      regionLabel: 'South China',
      livingCostLabel: '~¥2,200/月',
      displayProgramCount: 32,
      displayUndergraduateCount: 60,
      visibleProgramCount: 15,
      displaySubjectTags: ['数学', '中文(文科)', '中文(理科)', '物理', '化学'],
      programDisplayGroups: [
        { key: 'english_program', label: '英语授课专业', total: 5, visibleCount: 5 },
        { key: 'chinese_program', label: '汉语授课专业', total: 27, visibleCount: 10 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026-05-31',
          label: '部分中文授课项目截止',
          dateLabel: 'May 31, 2026',
          endDate: '2026-05-31',
          description: '截图显示 International Economics and Trade、Accounting、Finance、Business Administration、Law 等项目截止日期为 2026 年 5 月 31 日。'
        }
      ],
      programFieldTags: [
        'Economics',
        'Management',
        'Law',
        'Literature',
        'Journalism',
        'Medicine',
        'Engineering',
        'Science',
        'Art',
        'Education'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥2,200/月。',
  scholarships: [],
  englishPrograms: 'Accounting (International College)、Finance (International College)、International Economics and Trade (International College)、Computer Science and Technology (International College)、Clinical Medicine (International College)。',
  notablePrograms: 'International Economics and Trade、Accounting、Finance、Business Administration、Law、Journalism、Chinese Language and Literature、Computer Science and Technology、Software Engineering、Artificial Intelligence。',
  programFields: 'Economics、Management、Law、Literature、Journalism、Medicine、Engineering、Science、Art、Education。',
  source: 'csca-reference-screenshot',
  sourceId: 'jinan-university',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-05-31T00:00:00.000Z');

const basePrograms = [
  ['Accounting (International College)', 'Accounting (International College)', 'Management', '英文授课', ['数学'], 32000, '¥32,000/年', '4', 1, true, null],
  ['Finance (International College)', 'Finance (International College)', 'Economics', '英文授课', ['数学'], 25000, '¥25,000/年', '4', 2, true, null],
  ['International Economics and Trade (International College)', 'International Economics and Trade (International College)', 'Economics', '英文授课', ['数学'], 28000, '¥28,000/年', '4', 3, true, null],
  ['Computer Science and Technology (International College)', 'Computer Science and Technology (International College)', 'Engineering', '英文授课', ['数学', '物理'], 30000, '¥30,000/年', '4', 4, true, null],
  ['Clinical Medicine (International College)', 'Clinical Medicine (International College)', 'Medicine', '英文授课', ['数学', '化学'], 40000, '¥40,000/年', '6', 5, true, null],
  ['International Economics and Trade', 'International Economics and Trade', 'Economics', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 6, true, deadlineDate],
  ['Accounting', 'Accounting', 'Management', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 7, true, deadlineDate],
  ['Finance', 'Finance', 'Economics', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 8, true, deadlineDate],
  ['Business Administration', 'Business Administration', 'Management', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 9, true, deadlineDate],
  ['Law', 'Law', 'Law', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 10, true, deadlineDate],
  ['Journalism', 'Journalism', 'Journalism', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 11, true, null],
  ['Chinese Language and Literature', 'Chinese Language and Literature', 'Literature', '中文授课', ['中文(文科)', '数学'], 19000, '¥19,000/年', '4', 12, true, null],
  ['Computer Science and Technology', 'Computer Science and Technology', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 13, true, null],
  ['Software Engineering', 'Software Engineering', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 14, true, null],
  ['Artificial Intelligence', 'Artificial Intelligence', 'Engineering', '中文授课', ['中文(理科)', '数学', '物理'], 22000, '¥22,000/年', '4', 15, true, null]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, teachingLanguage, cscaSubjects, tuitionAmount, tuitionText, durationYears, sortOrder, hasScholarship, programDeadline]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears,
  fieldCategory,
  teachingLanguage,
  cscaSubjects,
  cscaRequirement: `CSCA：${cscaSubjects.join(' + ')}`,
  tuitionAmount,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText,
  deadlineDate: programDeadline,
  deadlineLabel: programDeadline ? 'May 31, 2026' : null,
  applicationRound: '2026 本科申请',
  scholarshipText: hasScholarship ? '有奖学金' : null,
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
    scope: '文科/人文类',
    cscaSubjects: ['中文(文科)', '数学'],
    description: '文科中文 + 数学。',
    sortOrder: 1
  },
  {
    title: '理工科类',
    category: 'science',
    scope: '理工科类',
    cscaSubjects: ['中文(理科)', '数学', '物理', '化学'],
    description: '理科中文 + 数学；部分专业仅需数学，或需数学 + 物理/化学。',
    sortOrder: 2
  },
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '特殊申请路径',
    cscaSubjects: [],
    languageCondition: '马来西亚 UEC 学生免 HSK；STPM 学生需 HSK5 级（180 分）以上；国际学院英语授课专业需雅思 5.5 或托福 80。',
    description: '马来西亚 UEC 学生免 HSK；STPM 学生需 HSK5 级（180 分）以上；国际学院英语授课专业需雅思 5.5 或托福 80。',
    sortOrder: 3
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '全部项目',
    cscaSubjects: [],
    description: '双一流高校；华侨最高学府；广州、深圳、珠海校区；接受马来西亚 UEC、STPM、SPM 成绩申请；部分专业仅需数学成绩。',
    sortOrder: 4
  }
].map((rule) => ({
  ...rule,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
}));

async function main() {
  await runSchoolSeed({
    schoolData,
    programs,
    cscaRules,
    scholarships: [],
    log: { note: '截图显示 32 个可选专业，统计卡显示 60 个本科；录入 15 个可见项目、4 条 CSCA 规则。' }
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
