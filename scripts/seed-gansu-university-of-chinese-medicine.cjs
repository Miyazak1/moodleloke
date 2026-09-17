const { prisma, runSchoolSeed, SchoolStatus } = require('./school-seed-helpers.cjs');

const VERIFIED_AT = new Date('2026-05-13T00:00:00.000Z');
const SOURCE_LABEL = '截图参考信息';

const schoolData = {
  nameZh: '甘肃中医药大学',
  nameEn: 'Gansu University of Chinese Medicine',
  schoolType: 'regular',
  region: 'Lanzhou, Northwest China',
  officialWebsite: null,
  applicationSystemUrl: null,
  admissionLevel: ['本科'],
  hskRequirement: 'HSK4 级 180 分及以上；2024 年 1 月 1 日之后获得。',
  hskMinLevel: 4,
  cscaRequired: true,
  cscaRequirement: '该大学的具体 CSCA 要求仍在确认中，请查看官方网站获取最新信息。',
  cscaRequirementNote: '西北地区唯一的中医药类本科院校；所有专业均为中文授课；统一学费 ¥16,000/年。',
  undergradRequirements: '截图显示甘肃中医药大学所有本科专业均为中文授课，具体 CSCA 要求仍在确认中。',
  languageOfInstruction: ['Chinese'],
  round1Deadline: '部分本科项目截止：2026 年 6 月 15 日。',
  round1CloseDate: '2026-06-15',
  applicationSteps: '先确认 HSK4 级 180 分及以上是否在有效期内；具体 CSCA 科目以学校后续确认信息为准。',
  tuitionSummary: '¥16,000/年。',
  tuitionByCategory: {
    chinesePrograms: '¥16,000/年',
    livingCost: '约 ¥1,200/月',
    display: {
      city: 'Lanzhou',
      regionLabel: 'Northwest China',
      livingCostLabel: '~¥1,200/月',
      displayProgramCount: 11,
      displayUndergraduateCount: 11,
      visibleProgramCount: 10,
      hiddenProgramNote: '还有1个汉语授课专业',
      displaySubjectTags: ['中文(文科)', '中文(理科)', '数学', '化学'],
      programDisplayGroups: [
        { key: 'chinese_program', label: '汉语授课专业', total: 11, visibleCount: 10, hiddenNote: '还有1个汉语授课专业' },
        { key: 'deadline_program', label: '即将截止项目', total: 5, visibleCount: 5 }
      ],
      applicationTimeline: [
        {
          key: 'deadline-2026',
          label: '本科项目截止',
          dateLabel: 'Jun 15, 2026',
          endDate: '2026-06-15',
          description: 'Traditional Chinese Medicine、Clinical Medicine of Integrated TCM and Western Medicine、Acupuncture Moxibustion and Tuina Massage、Preventive Medicine、Nursing 等项目显示该截止日期。'
        }
      ],
      programFieldTags: [
        'Traditional Chinese Medicine',
        'Clinical Medicine',
        'Chinese Materia Medica',
        'Pharmacy',
        'Economics'
      ]
    }
  },
  accommodationCost: '生活费参考约 ¥1,200/月。',
  scholarships: [],
  englishPrograms: '',
  notablePrograms: 'Traditional Chinese Medicine、Clinical Medicine of Integrated TCM and Western Medicine、Acupuncture Moxibustion and Tuina Massage、Preventive Medicine、Nursing、Chinese Materia Medica、Cultivation and Identification of Chinese Medicinal Herbs、Chinese Medicinal Resource and Development、Traditional Chinese Medicine Pharmaceutical Manufacturing、Pharmacy。',
  programFields: 'Traditional Chinese Medicine、Clinical Medicine、Chinese Materia Medica、Pharmacy、Economics。',
  source: 'csca-reference-screenshot',
  sourceId: 'gansu-university-of-chinese-medicine',
  sourceUrl: null,
  dataQualityScore: 100,
  lastVerifiedAt: VERIFIED_AT,
  status: SchoolStatus.published
};

const deadlineDate = new Date('2026-06-15T00:00:00.000Z');
const deadlineNames = new Set([
  'Traditional Chinese Medicine',
  'Clinical Medicine of Integrated TCM and Western Medicine',
  'Acupuncture Moxibustion and Tuina Massage',
  'Preventive Medicine',
  'Nursing'
]);

const basePrograms = [
  ['Traditional Chinese Medicine', 'Traditional Chinese Medicine', 'Traditional Chinese Medicine', '5', 1],
  ['Clinical Medicine of Integrated TCM and Western Medicine', 'Clinical Medicine of Integrated TCM and Western Medicine', 'Clinical Medicine', '5', 2],
  ['Acupuncture Moxibustion and Tuina Massage', 'Acupuncture Moxibustion and Tuina Massage', 'Traditional Chinese Medicine', '5', 3],
  ['Preventive Medicine', 'Preventive Medicine', 'Clinical Medicine', '5', 4],
  ['Nursing', 'Nursing', 'Nursing', '4', 5],
  ['Chinese Materia Medica', 'Chinese Materia Medica', 'Chinese Materia Medica', '4', 6],
  ['Cultivation and Identification of Chinese Medicinal Herbs', 'Cultivation and Identification of Chinese Medicinal Herbs', 'Chinese Materia Medica', '4', 7],
  ['Chinese Medicinal Resource and Development', 'Chinese Medicinal Resource and Development', 'Chinese Materia Medica', '4', 8],
  ['Traditional Chinese Medicine Pharmaceutical Manufacturing', 'Traditional Chinese Medicine Pharmaceutical Manufacturing', 'Pharmacy', '4', 9],
  ['Pharmacy', 'Pharmacy', 'Pharmacy', '4', 10]
];

const programs = basePrograms.map(([nameZh, nameEn, fieldCategory, durationYears, sortOrder]) => ({
  nameZh,
  nameEn,
  degreeLevel: '本科',
  durationYears,
  fieldCategory,
  teachingLanguage: '中文授课',
  cscaSubjects: ['中文(理科)', '数学', '化学'],
  cscaRequirement: 'CSCA：中文(理科) + 数学 + 化学（具体要求仍在确认中）',
  hskRequirement: 'HSK4 级 180 分及以上；2024 年 1 月 1 日之后获得。',
  tuitionAmount: 16000,
  tuitionCurrency: 'RMB',
  tuitionPeriod: 'year',
  tuitionText: '¥16,000/年',
  scholarshipText: '有奖学金',
  deadlineDate: deadlineNames.has(nameZh) ? deadlineDate : undefined,
  deadlineLabel: deadlineNames.has(nameZh) ? 'Jun 15, 2026' : undefined,
  applicationRound: deadlineNames.has(nameZh) ? '2026 本科申请' : undefined,
  sourceUrl: null,
  sourceLabel: SOURCE_LABEL,
  lastVerifiedAt: VERIFIED_AT,
  sortOrder,
  status: SchoolStatus.published
}));

const cscaRules = [
  {
    title: 'HSK 免考政策',
    category: 'language_policy',
    scope: '中文授课本科项目',
    cscaSubjects: [],
    languageCondition: 'HSK4 级 180 分及以上；2024 年 1 月 1 日之后获得。',
    description: '截图显示 HSK4 级 180 分及以上，且需为 2024 年 1 月 1 日之后获得。',
    sortOrder: 1
  },
  {
    title: '重要提示',
    category: 'notice',
    scope: '学校级申请判断',
    cscaSubjects: [],
    description: '西北地区唯一的中医药类本科院校；所有专业均为中文授课；统一学费 ¥16,000/年。',
    sortOrder: 2
  },
  {
    title: 'CSCA 要求确认中',
    category: 'notice',
    scope: '全部本科专业',
    cscaSubjects: ['中文(文科)', '中文(理科)', '数学', '化学'],
    description: '该大学的具体 CSCA 要求仍在确认中，请查看官方网站获取最新信息。',
    sortOrder: 3
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
    log: { note: '截图显示 11 个本科专业；本脚本录入截图可见 10 个专业、3 条 CSCA/提示规则和截止日期摘要。' }
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
