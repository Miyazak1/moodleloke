import { expect, test, type Page, type Route } from '@playwright/test';

const ENGLISH_PUBLIC_ROUTES = [
  '/',
  '/csca-prep',
  '/csca-exam-time',
  '/csca-subjects/math',
  '/csca-subjects/physics',
  '/csca-subjects/chemistry',
  '/csca-subjects/math/formulas',
  '/csca-subjects/physics/formulas',
  '/csca-subjects/chemistry/formulas',
  '/csca-subjects/math/vocabulary',
  '/csca-subjects/physics/vocabulary',
  '/csca-subjects/chemistry/vocabulary',
  '/csca-subjects/math/practice',
  '/csca-subjects/math/practice/rounds/701',
  '/csca-subjects/math/practice/rounds/701/report',
  '/csca-subjects/math/visualize',
  '/csca-subjects/math/visualize/trigonometric-functions',
  '/csca-subjects/math/visualize/function-transformations',
  '/csca-subjects/math/visualize/elementary-functions',
  '/csca-subjects/math/visualize/inequality-solutions',
  '/csca-subjects/math/visualize/sequence-visualizer',
  '/csca-subjects/math/visualize/probability-simulator',
  '/csca-subjects/math/visualize/vector-operations',
  '/csca-subjects/math/visualize/conic-sections',
  '/csca-subjects/math/visualize/coordinate-geometry',
  '/csca-subjects/math/visualize/solid-geometry',
  '/csca-subjects/math/visualize/calculus-area',
  '/csca-subjects/math/visualize/set-operations',
  '/csca-subjects/physics/visualize/newton-second-law',
  '/csca-subjects/physics/visualize/kinematics-graphs',
  '/csca-subjects/physics/visualize/energy-conservation',
  '/csca-subjects/physics/visualize/electric-field',
  '/csca-subjects/chemistry/visualize/acid-base-neutralization',
  '/csca-subjects/chemistry/visualize/ph-titration',
  '/csca-subjects/chemistry/visualize/reaction-rate',
  '/csca-subjects/chemistry/visualize/redox-cell',
  '/csca-subjects/chemistry/visualize/atomic-periodic',
  '/csca-subjects/chemistry/visualize/bonding-structure',
  '/csca-subjects/chemistry/visualize/ion-reactions',
  '/csca-subjects/chemistry/visualize/organic-hydrocarbons',
  '/csca-mock-exam',
  '/past-papers',
  '/services/consulting',
  '/services/ai-coach',
  '/me',
  '/feature-coming-soon',
  '/404',
  '/csca-mock-exam/math',
  '/csca-mock-exam/math/math-mock-1',
  '/csca-mock-exam/math/math-mock-2',
  '/csca-mock-exam/attempts/901',
  '/csca-mock-exam/attempts/901/report',
  '/auth',
  '/auth?error=google_failed',
  '/register'
];

const RAW_KEY_PATTERN = /\b(?:common|nav|header|footer|home|schools|schoolDetail|scholarships|studyChina|cscaPrep|mockExam)\.[A-Za-z0-9_.-]+/g;
const CHINESE_PATTERN = /[\u3400-\u9fff][\u3400-\u9fff\s（）()、，。：；“”《》·\w-]{0,28}/g;

function localizedPath(locale: 'en' | 'zh', path: string) {
  const [pathnameWithQuery, hash = ''] = path.split('#');
  const [pathname, query = ''] = pathnameWithQuery.split('?');
  const normalizedPathname = pathname === '/' ? '' : pathname;
  return `/${locale}${normalizedPathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

function json(route: Route, body: unknown) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

function sampleSchool() {
  return {
    id: 1,
    nameZh: '测试大学',
    nameEn: 'Test University',
    schoolType: 'Comprehensive university',
    region: 'Beijing',
    city: 'Beijing',
    cityZh: '北京',
    citySlug: 'beijing',
    regionLabel: 'Beijing',
    cscaRequired: true,
    cscaRequirement: 'CSCA is required for selected undergraduate programs.',
    cscaSubjects: ['Math', 'Physics'],
    subjectTags: ['Math', 'Physics'],
    languageTags: ['English-taught'],
    languageRequirement: 'IELTS or equivalent proof required.',
    hskRequirement: 'HSK may be waived for English-taught programs.',
    englishRequirement: 'IELTS 6.0',
    applicationLevel: 'Undergraduate',
    languageOfInstruction: ['English-taught'],
    deadlineSummary: 'Confirm deadline on the admissions page.',
    tuitionSummary: 'RMB 30,000/year',
    applicationFee: 'Confirm on official page',
    officialWebsiteUrl: 'https://example.com',
    admissionsWebsiteUrl: 'https://example.com/admissions',
    sourceUrl: 'https://example.com/admissions',
    sourceLabel: 'Official admissions page',
    verificationStatus: 'verified',
    isVerified: true,
    lastVerifiedAt: '2026-05-01',
    featuredPrograms: ['Computer Science'],
    fitNotes: ['Good fit for applicants comparing CSCA subjects and English programs.'],
    derivedTags: ['Verified source', 'English programs'],
    requiredSubjectTags: ['Math', 'Physics'],
    programCount: 1,
    undergraduateProgramCount: 1,
    postgraduateProgramCount: 0,
    englishProgramCount: 1,
    scholarshipCount: 1,
    cscScholarshipCount: 1,
    quickFacts: {
      location: 'Beijing',
      tuition: 'RMB 30,000/year',
      livingCost: 'Around RMB 2,500/month',
      programCount: 1,
      englishProgramCount: 1
    },
    decisionSummary: 'Start from program requirements, then plan CSCA subjects.',
    detailDisplay: {
      city: 'Beijing',
      regionLabel: 'Beijing',
      displayProgramCount: 1,
      applicationTimeline: [],
      quickFacts: []
    },
    cscaRules: [],
    programs: [
      {
        id: 101,
        version: 1,
        schoolId: 1,
        nameZh: '计算机科学',
        nameEn: 'Computer Science',
        degreeLevel: 'Undergraduate',
        durationYears: '4 years',
        fieldCategory: 'Computer Science',
        teachingLanguage: 'English-taught',
        cscaSubjects: ['Math', 'Physics'],
        cscaRequirement: 'Math and Physics',
        hskRequirement: 'HSK waived for English-taught programs',
        englishRequirement: 'IELTS 6.0',
        tuitionAmount: 30000,
        tuitionCurrency: 'RMB',
        tuitionPeriod: 'year',
        tuitionText: 'RMB 30,000/year',
        scholarshipText: 'University scholarship available',
        deadlineLabel: 'Confirm on admissions page',
        sourceUrl: 'https://example.com/program',
        sourceLabel: 'Program page',
        sortOrder: 1,
        status: 'published',
        isVerified: true
      }
    ],
    scholarshipsDetailed: [],
    upcomingDeadlines: [],
    applicationPortalNotes: 'Use the official admissions system.',
    campusHighlights: ['Confirm campus location before applying.'],
    contactNotes: ['Email: admissions@example.com']
  };
}

function schoolList() {
  return {
    items: [sampleSchool()],
    pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    facets: {
      regions: ['Beijing'],
      schoolTypes: ['Comprehensive university'],
      cscaOptions: [{ value: 'true', label: 'CSCA required', count: 1 }],
      applicationLevels: ['Undergraduate']
    },
    appliedFiltersSummary: []
  };
}

function compareSchool(id: number, nameEn: string, region: string) {
  return {
    ...sampleSchool(),
    id,
    nameZh: `测试大学${id}`,
    nameEn,
    region,
    city: region,
    cityZh: `城市${id}`,
    regionLabel: region,
    sourceLabel: 'Official admissions page',
    sourceUrl: `https://example.com/schools/${id}`,
    decisionSummary: 'Compare CSCA, teaching language, and tuition before choosing.',
    completenessLabel: 'High completeness',
    featuredPrograms: ['Computer Science', 'Software Engineering'],
    upcomingDeadlines: [{
      programName: 'Computer Science',
      deadlineDate: '2026-06-30',
      statusLabel: 'Open'
    }],
    programs: [{
      ...sampleSchool().programs[0],
      id: 100 + id,
      schoolId: id,
      deadlineDate: '2026-06-30',
      deadlineLabel: 'June 30, 2026'
    }]
  };
}

function scholarshipStats() {
  return { total: 1, fullFunding: 1, government: 1, countries: 1, types: 1 };
}

function scholarshipItem() {
  return {
    id: 1,
    slug: 'test-scholarship',
    title: 'Test University Full Scholarship',
    schoolId: 1,
    schoolName: 'Test University',
    schoolNameEn: 'Test University',
    schools: [{ id: 1, nameZh: '测试大学', nameEn: 'Test University', region: 'Beijing' }],
    schoolCount: 1,
    programs: [],
    type: 'government',
    typeLabel: 'Government scholarship',
    fundingLevel: 'full',
    coverage: 'Tuition, accommodation, stipend, and insurance.',
    applicableDegree: 'Undergraduate',
    applicableProgram: 'Computer Science',
    amountText: 'Confirm amount on official page.',
    requirementText: 'Confirm requirements on the official scholarship page.',
    targetCountries: ['All countries'],
    targetRegions: [],
    benefits: ['Tuition', 'Accommodation', 'Stipend'],
    sourceUrl: 'https://example.com/scholarship',
    sourceLabel: 'Official scholarship page',
    tags: ['Full funding', 'Government scholarship'],
    summary: 'A full funding option for eligible international students.'
  };
}

function serviceCart() {
  return {
    items: [
      {
        id: 501,
        type: 'ADVISOR_PACKAGE',
        title: 'Consulting package',
        quantity: 1,
        createdAt: '2026-05-01T00:00:00.000Z'
      },
      {
        id: 502,
        type: 'SCHOOL_SERVICE',
        schoolId: 1,
        schoolName: 'Test University',
        title: 'School requirement review',
        quantity: 1,
        createdAt: '2026-05-01T00:00:00.000Z'
      }
    ],
    pricing: {
      currency: 'USD',
      itemsTotalCents: 49900,
      discountTotalCents: 10000,
      payableTotalCents: 39900,
      pricingBreakdown: [
        {
          type: 'ADVISOR_PACKAGE',
          title: 'Consulting package',
          quantity: 1,
          unitAmountCents: 39900,
          originalAmountCents: 39900,
          discountAmountCents: 0,
          payableAmountCents: 39900
        },
        {
          type: 'SCHOOL_SERVICE',
          title: 'School requirement review',
          quantity: 1,
          unitAmountCents: 10000,
          originalAmountCents: 10000,
          discountAmountCents: 10000,
          payableAmountCents: 0,
          schoolId: 1
        }
      ]
    }
  };
}

function serviceOrder() {
  const cart = serviceCart();
  return {
    id: 9001,
    status: 'PENDING',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    payment: {
      id: 301,
      providerTxnId: 'mock-txn-301',
      amountCents: cart.pricing.payableTotalCents,
      currency: cart.pricing.currency,
      status: 'PENDING',
      createdAt: '2026-05-01T00:00:00.000Z'
    },
    itemsTotalCents: cart.pricing.itemsTotalCents,
    discountTotalCents: cart.pricing.discountTotalCents,
    payableTotalCents: cart.pricing.payableTotalCents,
    currency: cart.pricing.currency,
    pricingBreakdown: cart.pricing.pricingBreakdown,
    items: cart.pricing.pricingBreakdown.map((line, index) => ({ id: 800 + index, ...line }))
  };
}

function adminCityGuide() {
  return {
    id: 1,
    slug: 'beijing',
    nameZh: '北京',
    nameEn: 'Beijing',
    region: 'North China',
    monthlyCost: 2500,
    costLevel: 'High',
    density: 'High',
    tags: ['Capital', 'Research'],
    content: { summary: 'A major study destination.', why: [], costBreakdown: [], faqs: [] },
    nearby: ['tianjin'],
    references: {
      schoolCount: 20,
      programCount: 200,
      englishProgramCount: 60,
      scholarshipCount: 30,
      cscaRequiredSchoolCount: 8
    },
    status: 'published',
    sortOrder: 1,
    version: 1,
    updatedAt: '2026-05-01T00:00:00.000Z',
    aggregate: {
      actualSchoolCount: 20,
      actualProgramCount: 200,
      actualEnglishProgramCount: 60,
      actualScholarshipCount: 30,
      actualCscaRequiredSchoolCount: 8,
      visibleSchools: [],
      visiblePrograms: [],
      visibleScholarships: []
    }
  };
}

async function mockI18nPublicApis(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { message: 'Unauthenticated' }));
  await page.route('**/api/v1/search**', (route) => json(route, {
    query: '',
    total: 2,
    degraded: false,
    items: [
      { type: 'school', title: 'Test University', subtitle: 'Beijing', snippet: 'Compare CSCA, language, tuition, and application requirements.', href: '/schools/1', score: 1, metadata: { decisionSummary: 'Start from program requirements, then plan CSCA subjects.' } },
      { type: 'page', title: 'CSCA Prep', subtitle: 'Prep path', snippet: 'Work backward from school requirements before choosing practice.', href: '/csca-prep', score: 0.9 }
    ],
    groups: { school: 1, content: 0, practice: 0, page: 1 }
  }));
  await page.route('**/api/v1/public/content**', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/schools/1**', (route) => json(route, sampleSchool()));
  await page.route('**/api/v1/schools?**', (route) => json(route, schoolList()));
  await page.route('**/api/v1/me/saved-schools**', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/me/compare**', (route) => json(route, { items: [] }));

  await page.route('**/api/v1/csca-mock-exam/overview**', (route) => json(route, {
    examDate: '2026-06-27',
    countdownLabel: 'Next CSCA exam: June 27, 2026',
    subjectCards: [
      { id: 'math', title: 'Math', shortTitle: 'Math', accent: 'blue', description: 'Math mock exam', tags: ['Free first paper'], paperCount: 1, freeSlug: 'math-mock-1', questionCount: 48, durationMinutes: 60 }
    ],
    stats: [{ value: '48', label: 'questions', detail: 'Timed paper' }],
    features: ['Timed answering', 'Score report']
  }));
  await page.route('**/api/v1/csca-mock-exam/subjects/**', (route) => json(route, {
    subject: { id: 'math', title: 'Math', shortTitle: 'Math', accent: 'blue', description: 'Math mock exam', tags: ['Free first paper'] },
    papers: [
      {
        id: 1,
        subject: 'math',
        slug: 'math-mock-1',
        title: 'Math Mock Paper 1',
        description: 'Math original full-length mock paper, 48 questions / 60 minutes.',
        language: 'zh',
        questionCount: 48,
        durationMinutes: 60,
        priceLabel: 'Free',
        isFree: true,
        isLocked: false,
        status: 'published',
        sortOrder: 1
      },
      {
        id: 2,
        subject: 'math',
        slug: 'math-mock-2',
        title: 'Math Mock Paper 2',
        description: 'Math full mock paper. Unlock planning is in progress.',
        language: 'zh',
        questionCount: 48,
        durationMinutes: 60,
        priceLabel: '$19.99',
        isFree: false,
        isLocked: true,
        status: 'published',
        sortOrder: 2
      }
    ],
    bundle: { title: 'Bundle', priceLabel: 'Planned', description: 'More papers are planned.' }
  }));
  const mockPaper = {
    id: 1,
    subject: 'math',
    slug: 'math-mock-1',
    title: 'Math Mock Paper 1',
    description: 'Math original full-length mock paper, 48 questions / 60 minutes.',
    language: 'zh',
    questionCount: 48,
    durationMinutes: 60,
    priceLabel: 'Free',
    isFree: true,
    isLocked: false,
    status: 'published',
    sortOrder: 1
  };
  const lockedMockPaper = {
    ...mockPaper,
    id: 2,
    slug: 'math-mock-2',
    title: 'Math Mock Paper 2',
    description: 'Math full mock paper. Unlock planning is in progress.',
    priceLabel: '$19.99',
    isFree: false,
    isLocked: true
  };
  const mockQuestion = {
    id: 1001,
    orderNumber: 1,
    prompt: 'Which expression represents a linear function?',
    options: [
      { id: 'A', text: 'y = 2x + 1' },
      { id: 'B', text: 'y = x^2' }
    ],
    correctAnswer: 'A',
    explanation: 'A linear function has degree one and a constant rate of change.',
    knowledgeTags: ['Functions']
  };
  await page.route('**/api/v1/csca-mock-exam/papers/math-mock-1/start**', (route) => json(route, {
    paper: mockPaper,
    locked: false,
    rules: [
      'The timer starts after you begin.',
      'After submission, you can view your score, wrong answers, and explanations.',
      'This is original simulated practice and does not represent official exam content.'
    ]
  }));
  await page.route('**/api/v1/csca-mock-exam/papers/math-mock-2/start**', (route) => json(route, {
    paper: lockedMockPaper,
    locked: true,
    rules: []
  }));
  await page.route('**/api/v1/csca-mock-exam/attempts/901/report', (route) => json(route, {
    attempt: {
      id: 901,
      paper: mockPaper,
      startedAt: '2026-05-01T00:00:00.000Z',
      dueAt: '2026-05-01T01:00:00.000Z',
      submittedAt: '2026-05-01T00:05:00.000Z',
      answers: { '1001': 'A' },
      markedQuestions: [1001],
      timeSpent: { '1001': 45 },
      currentQuestion: 1,
      version: 1
    },
    summary: { score: 100, correctCount: 1, wrongCount: 0, unansweredCount: 0, totalSeconds: 45, averageSeconds: 45 },
    knowledgeStats: [{ tag: 'Functions', total: 1, wrong: 0 }],
    items: [{
      ...mockQuestion,
      selected: 'A',
      isCorrect: true,
      isUnanswered: false,
      isMarked: true,
      secondsSpent: 45
    }]
  }));
  await page.route('**/api/v1/csca-mock-exam/attempts/901', (route) => json(route, {
    attempt: {
      id: 901,
      paper: mockPaper,
      startedAt: '2026-05-01T00:00:00.000Z',
      dueAt: '2099-05-01T01:00:00.000Z',
      submittedAt: null,
      answers: {},
      markedQuestions: [],
      timeSpent: {},
      currentQuestion: 1,
      version: 1
    },
    questions: [mockQuestion]
  }));
  await page.route('**/api/v1/csca-special-practice/overview**', (route) => json(route, {
    subjects: [
      { id: 'math', title: 'Math', description: 'Focused CSCA math practice.', tags: ['Functions'], topicCount: 1, questionCount: 12, freeTopicSlug: 'math-function' },
      { id: 'physics', title: 'Physics', description: 'Focused CSCA physics practice.', tags: ['Mechanics'], topicCount: 1, questionCount: 10, freeTopicSlug: 'physics-motion' },
      { id: 'chemistry', title: 'Chemistry', description: 'Focused CSCA chemistry practice.', tags: ['Reactions'], topicCount: 1, questionCount: 10, freeTopicSlug: 'chemistry-redox' }
    ],
    totals: { subjectCount: 3, topicCount: 3, questionCount: 32 },
    features: ['Instant feedback', 'Saved progress', 'Mock exam bridge'],
    mockExamPath: '/csca-mock-exam',
    mockExamRule: { durationMinutes: 60, questionCount: 48, totalScore: 100, questionTypeLabel: 'Single choice' }
  }));
  await page.route('**/api/v1/csca-special-practice/subjects/*', (route) => {
    const subject = route.request().url().split('/').pop() ?? 'math';
    const title = ({ math: 'Math', physics: 'Physics', chemistry: 'Chemistry' } as Record<string, string>)[subject] ?? 'Math';
    const module = ({ math: '函数', physics: '力学', chemistry: '反应原理' } as Record<string, string>)[subject] ?? '函数';
    const topicSlug = ({ math: 'math-function', physics: 'physics-motion', chemistry: 'chemistry-redox' } as Record<string, string>)[subject] ?? 'math-function';
    const chineseTopic = ({
      math: { title: '基本初等函数', description: '识别一次、二次、指数、对数和幂函数的图像与性质。' },
      physics: { title: '牛顿第二定律 F=ma 交互模拟', description: '调节质量、合力和摩擦，观察加速度如何变化。' },
      chemistry: { title: '氧化还原反应', description: '判断化合价变化、氧化剂和还原剂。' }
    } as Record<string, { title: string; description: string }>)[subject];
    json(route, {
      subject: { id: subject, title, description: `${title} targeted practice.`, tags: [module] },
      stats: { topicCount: 1, questionCount: 12, estimatedMinutes: 20 },
      mockExamRule: { durationMinutes: 60, questionCount: 48, totalScore: 100, questionTypeLabel: 'Single choice' },
      modules: [{
        module,
        topics: [{
          id: 1,
          subject,
          module,
          slug: topicSlug,
          title: chineseTopic.title,
          description: chineseTopic.description,
          estimatedMinutes: 20,
          questionCount: 12,
          publishedQuestionCount: 12,
          sessionCount: 0,
          difficultyLabel: 'Core',
          frequencyLabel: 'High frequency'
        }]
      }]
    });
  });
  await page.route('**/api/v1/csca-special-practice/topics/*/start', (route) => {
    const slug = route.request().url().split('/').slice(-2)[0] ?? 'math-function';
    const subject = slug.startsWith('physics') ? 'physics' : slug.startsWith('chemistry') ? 'chemistry' : 'math';
    const title = ({ math: 'Math', physics: 'Physics', chemistry: 'Chemistry' } as Record<string, string>)[subject];
    const module = ({ math: 'Functions', physics: 'Mechanics', chemistry: 'Reaction Principles' } as Record<string, string>)[subject];
    json(route, {
      topic: {
        id: 1,
        subject,
        module,
        slug,
        title: `${title} Topic Review`,
        description: `Short focused review for ${title}.`,
        estimatedMinutes: 20,
        questionCount: 12,
        publishedQuestionCount: 12,
        sessionCount: 0,
        difficultyLabel: 'Core',
        frequencyLabel: 'High frequency'
      },
      focus: ['Core definition', 'Typical single-choice setup', 'Common mistakes'],
      advice: 'Start with accuracy, then return to timed mock practice.',
      questionPreviewCount: 12,
      availableLanguages: ['en'],
      currentLanguage: 'en'
    });
  });
  const practiceTopic = {
    id: 1,
    subject: 'math',
    module: 'Functions',
    slug: 'math-function',
    title: 'Math Topic Review',
    description: 'Short focused review for Math.',
    estimatedMinutes: 20,
    questionCount: 1,
    publishedQuestionCount: 1,
    sessionCount: 1,
    difficultyLabel: 'Core',
    frequencyLabel: 'High frequency'
  };
  const practiceQuestion = {
    id: 101,
    orderNumber: 1,
    difficulty: 'Core',
    questionType: 'Single choice',
    prompt: 'Which expression represents a linear function?',
    options: [
      { id: 'A', text: 'y = 2x + 1' },
      { id: 'B', text: 'y = x^2' }
    ]
  };
  await page.route('**/api/v1/csca-special-practice/sessions/701/report', (route) => json(route, {
    session: {
      id: 701,
      topic: practiceTopic,
      language: 'en',
      availableLanguages: ['en'],
      startedAt: '2026-05-01T00:00:00.000Z',
      completedAt: '2026-05-01T00:05:00.000Z',
      answers: { '101': 'A' },
      timeSpent: { '101': 35 },
      currentQuestion: 1,
      correctCount: 1,
      wrongCount: 0,
      unansweredCount: 0,
      version: 1
    },
    summary: { correctCount: 1, wrongCount: 0, unansweredCount: 0, total: 1, accuracy: 100, totalSeconds: 35, averageSeconds: 35 },
    weakTags: [{ tag: 'Functions', total: 1, wrong: 0 }],
    items: [{
      ...practiceQuestion,
      selected: 'A',
      correctAnswer: 'A',
      isCorrect: true,
      isUnanswered: false,
      explanation: 'A linear function has degree one and a constant rate of change.',
      knowledgeTags: ['Functions'],
      secondsSpent: 35
    }]
  }));
  await page.route('**/api/v1/csca-special-practice/sessions/701/check', (route) => json(route, {
    questionId: 101,
    selected: 'A',
    correctAnswer: 'A',
    isCorrect: true,
    explanation: 'A linear function has degree one and a constant rate of change.',
    knowledgeTags: ['Functions']
  }));
  await page.route('**/api/v1/csca-special-practice/sessions/701/submit', (route) => json(route, {
    session: {
      id: 701,
      topic: practiceTopic,
      language: 'en',
      availableLanguages: ['en'],
      startedAt: '2026-05-01T00:00:00.000Z',
      completedAt: '2026-05-01T00:05:00.000Z',
      answers: { '101': 'A' },
      timeSpent: { '101': 35 },
      currentQuestion: 1,
      correctCount: 1,
      wrongCount: 0,
      unansweredCount: 0,
      version: 1
    }
  }));
  await page.route('**/api/v1/csca-special-practice/sessions/701', (route) => json(route, {
    session: {
      id: 701,
      topic: practiceTopic,
      language: 'en',
      availableLanguages: ['en'],
      startedAt: '2026-05-01T00:00:00.000Z',
      completedAt: null,
      answers: {},
      timeSpent: {},
      currentQuestion: 1,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 1,
      version: 1
    },
    questions: [practiceQuestion]
  }));
  await page.route('**/api/v1/scholarships/types**', (route) => json(route, {
    items: [{ key: 'government', title: 'Government scholarship', icon: 'lucide:landmark', tone: 'blue', body: 'CSC and government-funded routes.', coverage: 'Tuition and living support', difficulty: 'Competitive', count: 1, full: 1 }],
    stats: scholarshipStats()
  }));
  await page.route('**/api/v1/scholarships/countries**', (route) => json(route, {
    hotCountries: [{ code: 'ALL', name: 'All countries', region: 'Global', count: 1 }],
    countries: [{ code: 'ALL', name: 'All countries', region: 'Global', count: 1 }],
    regions: [{ region: 'Global', count: 1 }],
    stats: scholarshipStats()
  }));
  await page.route('**/api/v1/scholarships/test-scholarship**', (route) => json(route, {
    item: scholarshipItem(),
    schools: [{ id: 1, nameZh: '测试大学', nameEn: 'Test University', region: 'Beijing' }],
    programs: [],
    similar: []
  }));
  await page.route('**/api/v1/scholarships?**', (route) => json(route, {
    items: [scholarshipItem()],
    pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    facets: {
      types: [{ key: 'government', title: 'Government scholarship', icon: 'lucide:landmark', tone: 'blue', body: 'CSC and government-funded routes.', coverage: 'Tuition and living support', difficulty: 'Competitive', count: 1, full: 1 }],
      countries: [{ code: 'ALL', name: 'All countries', region: 'Global', count: 1 }],
      regions: [{ region: 'Global', count: 1 }],
      fundingLevels: [{ value: 'full', label: 'Full funding', count: 1 }]
    },
    stats: scholarshipStats()
  }));

  await page.route('**/api/v1/study-china/cities/beijing**', (route) => json(route, {
    city: {
      slug: 'beijing',
      nameZh: '北京',
      nameEn: 'Beijing',
      region: '华北',
      monthlyCost: 2500,
      costLevel: '高',
      density: '高',
      tags: [],
      content: {},
      nearby: [],
      references: { schoolCount: 1, programCount: 1, englishProgramCount: 1, scholarshipCount: 1, cscaRequiredSchoolCount: 1 },
      status: 'published',
      sortOrder: 1,
      version: 1,
      updatedAt: '2026-05-01T00:00:00.000Z'
    },
    aggregate: {
      actualSchoolCount: 1,
      actualProgramCount: 1,
      actualEnglishProgramCount: 1,
      actualScholarshipCount: 1,
      actualCscaRequiredSchoolCount: 1,
      visibleSchools: [{ key: 'school-1', id: 1, nameZh: '测试大学', nameEn: 'Test University', region: 'Beijing', programCount: 1, englishProgramCount: 1, scholarshipCount: 1 }],
      visiblePrograms: [{ key: 'program-1', schoolId: 1, schoolName: 'Test University', title: 'Computer Science', meta: 'Undergraduate · English-taught', tuition: 'RMB 30,000/year', deadline: 'Confirm on admissions page', tags: ['CSCA'] }],
      visibleScholarships: [{ key: 'scholarship-1', schoolId: 1, schoolName: 'Test University', title: 'Full Scholarship', meta: 'Full funding', tags: ['CSC'] }]
    }
  }));
  await page.route('**/api/v1/study-china/cities**', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/study-china/timeline**', (route) => json(route, {
    stats: { deadlineItemCount: 1, schoolCount: 1, urgent7Count: 0, urgent30Count: 1, scholarshipSchoolCount: 1, englishProgramSchoolCount: 1 },
    windows: [{ id: 1, month: '6月', title: 'Main application window', applicationWindow: 'June', cscaWindow: 'Plan CSCA before June', status: 'published', sortOrder: 1, version: 1 }],
    schools: [{
      key: 'school-1',
      school: { id: 1, nameZh: '测试大学', nameEn: 'Test University', region: 'Beijing', programCount: 1, englishProgramCount: 1, scholarshipCount: 1, cscScholarshipCount: 1 },
      rows: [{ key: 'program-1', schoolId: 1, schoolName: 'Test University', schoolNameEn: 'Test University', title: 'Computer Science', degree: 'Undergraduate', language: 'English-taught', field: 'Computer Science', tuition: 'RMB 30,000/year', deadline: 'Confirm on admissions page', days: 25, tags: ['CSCA'] }],
      earliest: { key: 'program-1', schoolId: 1, schoolName: 'Test University', schoolNameEn: 'Test University', title: 'Computer Science', deadline: 'Confirm on admissions page', days: 25, tags: ['CSCA'] }
    }],
    programs: [{ key: 'program-1', schoolId: 1, schoolName: 'Test University', schoolNameEn: 'Test University', title: 'Computer Science', degree: 'Undergraduate', language: 'English-taught', field: 'Computer Science', tuition: 'RMB 30,000/year', deadline: 'Confirm on admissions page', days: 25, tags: ['CSCA'] }]
  }));
}

async function getVisibleTextHealth(page: Page) {
  return page.evaluate(({ rawKeySource, chineseSource }) => {
    const rawKeyPattern = new RegExp(rawKeySource, 'g');
    const chinesePattern = new RegExp(chineseSource, 'g');
    const text = document.body.innerText || '';
    return {
      chinese: Array.from(new Set((text.match(chinesePattern) || []).map((item) => item.trim()).filter(Boolean))).slice(0, 20),
      rawKeys: Array.from(new Set(text.match(rawKeyPattern) || [])).slice(0, 20),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      h1: document.querySelector('h1')?.textContent?.trim() || ''
    };
  }, { rawKeySource: RAW_KEY_PATTERN.source, chineseSource: CHINESE_PATTERN.source });
}

test.beforeEach(async ({ page }) => {
  await mockI18nPublicApis(page);
});

test.describe('English i18n smoke', () => {
  for (const path of ENGLISH_PUBLIC_ROUTES) {
    test(`${path} has no raw keys, Chinese text, or horizontal overflow`, async ({ page }) => {
      await page.goto(localizedPath('en', path));
      await expect(page.locator('body')).not.toContainText('Loading page');

      const health = await getVisibleTextHealth(page);
      expect(health.rawKeys, `${path} raw i18n keys`).toEqual([]);
      expect(health.chinese, `${path} visible Chinese text`).toEqual([]);
      expect(health.overflow, `${path} should not overflow horizontally`).toBe(false);
      expect(health.h1 || await page.title(), `${path} should render meaningful content`).toBeTruthy();
    });
  }
});

test.describe('Formula page localized content parity', () => {
  test('English math formula page uses the shared simulation entries', async ({ page }) => {
    await page.goto(localizedPath('en', '/csca-subjects/math/formulas'));

    const simulations = page.locator('.subject-formula-simulations[data-subject="math"]');
    await expect(simulations.getByRole('heading', { name: 'Interactive Models' })).toBeVisible();
    await expect(simulations.locator('article')).toHaveCount(12);
    await expect(simulations.getByText('Trigonometric Functions and Unit Circle')).toBeVisible();
    await expect(simulations.getByText('Function Transformations')).toBeVisible();
    await expect(simulations.getByText('3D Coordinate Geometry')).toBeVisible();
    await expect(simulations.getByText('Targeted Practice')).toHaveCount(0);
  });

  test('English physics formula page uses the shared simulation entries', async ({ page }) => {
    await page.goto(localizedPath('en', '/csca-subjects/physics/formulas'));

    const simulations = page.locator('.subject-formula-simulations[data-subject="physics"]');
    await expect(simulations.getByRole('heading', { name: 'Interactive Simulations' })).toBeVisible();
    await expect(simulations.locator('article')).toHaveCount(15);
    await expect(simulations.getByText("Newton's Second Law F=ma")).toBeVisible();
    await expect(simulations.getByText('Kinematics Interactive Simulation')).toBeVisible();
    await expect(simulations.getByText('Work and Energy Interactive Simulation')).toBeVisible();
    await expect(simulations.getByText('Targeted Practice')).toHaveCount(0);

    await simulations.locator('article').filter({ hasText: "Newton's Second Law F=ma" }).click();
    await expect(page).toHaveURL(/\/en\/csca-subjects\/physics\/visualize\/newton-second-law/);
  });

  test('English chemistry formula page uses the shared simulation entries', async ({ page }) => {
    await page.goto(localizedPath('en', '/csca-subjects/chemistry/formulas'));

    const simulations = page.locator('.subject-formula-simulations[data-subject="chemistry"]');
    await expect(simulations.getByRole('heading', { name: 'Interactive Practice' })).toBeVisible();
    await expect(simulations.locator('article')).toHaveCount(11);
    await expect(simulations.getByText('Acid-Base Neutralization')).toBeVisible();
    await expect(simulations.getByText('Mole Calculation Tool')).toBeVisible();
    await expect(simulations.getByText('Organic Chemistry Explorer')).toBeVisible();
    await expect(simulations.getByText('Targeted Practice')).toHaveCount(0);
  });
});

test.describe('Header navigation dropdowns', () => {
  test('English dropdown menus open on click', async ({ page }) => {
    await page.goto(localizedPath('en', '/'));
    await page.getByRole('button', { name: /Subjects/i }).click();
    await expect(page.getByRole('menu', { name: /Subjects menu/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Math/i })).toBeVisible();
  });

  test('Chinese dropdown menus open on click', async ({ page }) => {
    await page.goto(localizedPath('zh', '/'));
    await page.getByRole('button', { name: /科目学习/ }).click();
    await expect(page.getByRole('menu', { name: /科目学习菜单/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /数学/ })).toBeVisible();
  });
});

test.describe('Subject page navigation', () => {
  test('English diagnostic entry sends a guest to login without refresh', async ({ page }) => {
    await page.goto(localizedPath('en', '/csca-subjects/physics'));

    await page.locator('#practice').getByRole('button', { name: 'Start 20-question diagnostic' }).click();

    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.getByRole('heading', { name: /Log in to continue your CSCA path/i })).toBeVisible();
  });
});

test.describe('Account workspace i18n', () => {
  test('English logged-in account sections have no visible Chinese', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => json(route, {
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'student'
    }));
    await page.route('**/api/v1/csca-mock-exam/my-attempts', (route) => json(route, { items: [] }));
    await page.route('**/api/v1/csca-special-practice/my-sessions', (route) => json(route, { items: [] }));
    await page.route('**/api/v1/csca-special-practice/my-wrong-questions**', (route) => json(route, { items: [] }));
    await page.route('**/api/v1/me/saved-schools**', (route) => json(route, { items: [] }));
    await page.route('**/api/v1/me/compare**', (route) => json(route, { items: [] }));
    await page.route('**/api/v1/commerce/orders**', (route) => json(route, { items: [] }));

    await page.addInitScript(() => {
      window.localStorage.setItem('cscalite.accessToken', 'test-token');
    });

    await page.goto(localizedPath('en', '/me'));
    await expect(page.getByRole('heading', { name: 'Learner' })).toBeVisible();

    for (const name of ['Overview', 'Settings', 'Practice records', 'Mistake review', 'Online mocks']) {
      await page.getByRole('button', { name }).click();
      const health = await getVisibleTextHealth(page);
      expect(health.rawKeys, `/me logged-in ${name} raw i18n keys`).toEqual([]);
      expect(health.chinese, `/me logged-in ${name} visible Chinese text`).toEqual([]);
      expect(health.overflow, `/me logged-in ${name} should not overflow horizontally`).toBe(false);
    }
  });
});

test.describe('Retired commerce i18n', () => {
  test.skip('English legacy commerce pages render without Chinese', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => json(route, {
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user'
    }));
    await page.route('**/api/v1/commerce/cart/items**', (route) => json(route, serviceCart()));
    await page.route('**/api/v1/commerce/cart', (route) => json(route, serviceCart()));
    await page.route('**/api/v1/commerce/orders**', (route) => json(route, { items: [serviceOrder()] }));
    await page.route('**/api/v1/commerce/checkout', (route) => json(route, serviceOrder()));
    await page.route('**/api/v1/commerce/payments', (route) => json(route, {
      paymentId: 301,
      orderId: 9001,
      providerTxnId: 'mock-txn-301',
      amountCents: 39900,
      currency: 'USD',
      status: 'PENDING',
      callbackSignaturePayload: 'mock payload',
      testCallbackSignature: 'mock-signature'
    }));
    await page.route('**/api/v1/commerce/payments/callback', (route) => json(route, {
      received: true,
      idempotent: false,
      paymentId: 301,
      orderId: 9001,
      paymentStatus: 'SUCCEEDED',
      orderStatus: 'PAID'
    }));

    await page.addInitScript(() => {
      window.localStorage.setItem('cscalite.accessToken', 'test-token');
    });

    await page.goto(localizedPath('en', '/services/consulting'));
    await page.getByRole('button', { name: 'Add consulting package' }).click();
    await expect(page.getByText('The consulting package has been added.')).toBeVisible();
    let health = await getVisibleTextHealth(page);
    expect(health.rawKeys, '/services/consulting raw i18n keys').toEqual([]);
    expect(health.chinese, '/services/consulting visible Chinese text').toEqual([]);
    expect(health.overflow, '/services/consulting should not overflow horizontally').toBe(false);

    await page.goto(localizedPath('en', '/cart'));
    await expect(page.getByText('Consulting package').first()).toBeVisible();
    await expect(page.getByText('School requirement review').first()).toBeVisible();
    health = await getVisibleTextHealth(page);
    expect(health.rawKeys, '/cart raw i18n keys').toEqual([]);
    expect(health.chinese, '/cart visible Chinese text').toEqual([]);
    expect(health.overflow, '/cart should not overflow horizontally').toBe(false);

    await page.goto(localizedPath('en', '/checkout'));
    await page.getByRole('button', { name: 'Create order and payment' }).click();
    await expect(page.getByText('Order #9001 created; payment record #301 generated.')).toBeVisible();
    await page.getByRole('button', { name: 'Simulate successful payment' }).click();
    await expect(page.getByText('Mock payment completed: order PAID, payment SUCCEEDED.')).toBeVisible();
    health = await getVisibleTextHealth(page);
    expect(health.rawKeys, '/checkout raw i18n keys').toEqual([]);
    expect(health.chinese, '/checkout visible Chinese text').toEqual([]);
    expect(health.overflow, '/checkout should not overflow horizontally').toBe(false);

    await page.goto(localizedPath('en', '/orders'));
    await expect(page.getByText('Order #9001')).toBeVisible();
    health = await getVisibleTextHealth(page);
    expect(health.rawKeys, '/orders raw i18n keys').toEqual([]);
    expect(health.chinese, '/orders visible Chinese text').toEqual([]);
    expect(health.overflow, '/orders should not overflow horizontally').toBe(false);
  });
});

test.describe('Retired school compare i18n', () => {
  test.skip('English legacy comparison table has no visible Chinese', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => json(route, {
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user'
    }));
    await page.route('**/api/v1/me/compare/details**', (route) => json(route, {
      items: [
        compareSchool(1, 'North Test University', 'Beijing'),
        compareSchool(2, 'South Test University', 'Shanghai')
      ]
    }));

    await page.addInitScript(() => {
      window.localStorage.setItem('cscalite.accessToken', 'test-token');
    });

    await page.goto(localizedPath('en', '/compare'));
    await expect(page.getByRole('heading', { name: 'Compare schools in one shared view.' })).toBeVisible();
    await expect(page.getByText('North Test University')).toBeVisible();
    await expect(page.getByText('South Test University')).toBeVisible();
    await expect(page.getByText('CSCA status')).toBeVisible();
    await expect(page.getByText('Tuition overview')).toBeVisible();

    const health = await getVisibleTextHealth(page);
    expect(health.rawKeys, '/compare logged-in raw i18n keys').toEqual([]);
    expect(health.chinese, '/compare logged-in visible Chinese text').toEqual([]);
    expect(health.overflow, '/compare logged-in should not overflow horizontally').toBe(false);
  });
});

test.describe('Admin i18n', () => {
  test.skip('legacy multi-module admin matrix has no visible Chinese', async ({ page }) => {
    const adminSchool = {
      id: 1,
      nameZh: '测试大学',
      nameEn: 'Test University',
      region: 'Beijing',
      schoolType: 'Public',
      cscaRequired: true,
      verificationStatus: 'verified',
      status: 'published',
      sourceLabel: 'Official admissions page',
      sourceUrl: 'https://example.com/school',
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 1
    };
    const scholarship = {
      id: 301,
      version: 1,
      slug: 'test-scholarship',
      title: 'International Merit Scholarship',
      type: 'government',
      fundingLevel: 'full',
      summary: 'Funding support for eligible international students.',
      coverage: 'Tuition and living stipend',
      applicableDegree: 'Undergraduate',
      applicableProgram: 'Engineering',
      amountText: 'Full tuition coverage',
      requirementText: 'Strong academic record required.',
      deadlineDate: '2026-05-31',
      deadlineLabel: 'May 31, 2026',
      applicationRound: '2026 intake',
      targetCountries: ['TH', 'VN'],
      targetRegions: ['Southeast Asia'],
      benefits: ['Tuition', 'Living stipend'],
      sourceUrl: 'https://example.com/scholarship',
      sourceLabel: 'Official scholarship page',
      lastVerifiedAt: '2026-05-01',
      sortOrder: 1,
      status: 'draft',
      schoolIds: [1],
      programIds: [],
      schools: [{ id: 1, nameZh: '测试大学', nameEn: 'Test University', region: 'Beijing', status: 'published' }],
      programs: [],
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z'
    };
    const contentBlock = {
      id: 'content-1',
      key: 'home.hero',
      locale: 'en',
      requestedLocale: 'en',
      isFallback: false,
      title: 'Study in China with CSCA clarity',
      subtitle: 'Homepage hero',
      body: {
        body: 'Keep admissions requirements, CSCA subjects, and deadlines in one place.',
        proofPills: ['Verified requirements', 'Timeline ready', 'Practice linked']
      },
      status: 'draft',
      sortOrder: 1,
      version: 1,
      updatedAt: '2026-05-02T00:00:00.000Z'
    };
    const mockPaper = {
      id: 101,
      subject: 'math',
      slug: 'math-mock-1',
      title: 'Math Mock Paper 1',
      description: 'Original simulated math paper.',
      language: 'en',
      durationMinutes: 60,
      questionCount: 48,
      priceLabel: 'Free',
      isFree: true,
      isLocked: false,
      sortOrder: 1,
      status: 'draft',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      questionTotal: 1,
      attemptTotal: 0,
      version: 1
    };
    const specialTopic = {
      id: 201,
      subject: 'math',
      module: 'Functions',
      slug: 'math-function-admin',
      title: 'Functions Review',
      description: 'Focused practice for functions.',
      overview: 'Review function notation, graph reading, and transformations.',
      focusItems: ['Function notation', 'Graphs', 'Transformations'],
      studyAdvice: 'Check definitions first, then practice single-choice traps.',
      frequencyLabel: 'High frequency',
      difficultyLabel: 'Core',
      relatedResources: [{ label: 'Math guide', path: '/csca-subjects/math' }],
      relatedVisualizerSlug: 'elementary-functions',
      estimatedMinutes: 20,
      questionCount: 1,
      sortOrder: 1,
      status: 'draft',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      questionTotal: 1,
      sessionTotal: 0,
      version: 1
    };

    await page.route('**/api/v1/auth/me', (route) => json(route, {
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin'
    }));
    await page.route('**/api/v1/admin/audit-logs', (route) => json(route, {
      items: [
        { id: 'audit-1', title: 'Review pending schools', detail: 'Check sources and update verification status.', status: 'Open' }
      ]
    }));
    await page.route('**/api/v1/admin/practice/summary', (route) => json(route, {
      schoolsTotal: 20,
      schoolsVerified: 12,
      schoolsPending: 8,
      adminAuditEventCount: 1,
      latestAdminAuditEventAt: '2026-05-01T00:00:00.000Z',
      schoolChangeCount: 3,
      latestSchoolChangeAt: '2026-05-01T00:00:00.000Z',
      mockExamAttemptCount: 9,
      specialPracticeSessionCount: 4
    }));
    await page.route('**/api/v1/admin/audit-events', (route) => json(route, {
      items: [{
        id: 'event-1',
        action: 'Update school',
        module: 'schools',
        resourceType: 'school',
        resourceId: '1',
        actorEmail: 'admin@example.com',
        createdAt: '2026-05-01T00:00:00.000Z'
      }]
    }));
    await page.route('**/api/v1/admin/study-china/timeline-windows', (route) => json(route, {
      items: [{
        id: 1,
        month: 'June',
        title: 'Main application window',
        applicationWindow: 'Most schools publish final program requirements.',
        cscaWindow: 'Confirm CSCA subjects before submitting materials.',
        status: 'published',
        sortOrder: 1,
        version: 1
      }]
    }));
    await page.route('**/api/v1/admin/study-china/cities', (route) => json(route, { items: [adminCityGuide()] }));
    await page.route('**/api/v1/admin/content/blocks**', (route) => json(route, { items: [contentBlock] }));
    await page.route('**/api/v1/admin/schools', (route) => json(route, { items: [adminSchool], summary: { total: 1, verified: 1, pending: 0 } }));
    await page.route('**/api/v1/admin/schools/1', (route) => json(route, {
      ...adminSchool,
      cscaRequirement: 'Check CSCA subject requirements before publishing.',
      languageRequirement: 'Confirm English or HSK evidence before application.',
      tuitionSummary: 'RMB 30,000/year',
      applicationFee: 'RMB 600',
      officialWebsiteUrl: 'https://example.com',
      admissionsWebsiteUrl: 'https://example.com/admissions',
      source: 'manual',
      sourceId: 'test-school',
      lastVerifiedAt: '2026-05-01',
      missingFields: [],
      completenessLabel: 'Core fields complete',
      programs: [],
      cscaRules: [],
      scholarshipsDetailed: []
    }));
    await page.route('**/api/v1/admin/schools/1/change-logs', (route) => json(route, {
      items: [{
        id: 1,
        action: 'Update school',
        actorEmail: 'admin@example.com',
        changes: ['Updated source URL'],
        createdAt: '2026-05-02T00:00:00.000Z'
      }]
    }));
    await page.route('**/api/v1/admin/scholarships', (route) => json(route, {
      items: [scholarship],
      summary: { total: 1, published: 0, draft: 1 }
    }));
    await page.route('**/api/v1/admin/mock-exam/papers', (route) => json(route, {
      items: [mockPaper],
      summary: { total: 1, published: 0, draft: 1 }
    }));
    await page.route('**/api/v1/admin/mock-exam/papers/101', (route) => json(route, {
      paper: mockPaper,
      questions: [{
        id: 1001,
        paperId: 101,
        orderNumber: 1,
        questionType: 'single-choice',
        prompt: 'Which expression is linear?',
        options: [
          { id: 'A', text: 'y = 2x + 1' },
          { id: 'B', text: 'y = x^2' },
          { id: 'C', text: 'y = 1 / x' },
          { id: 'D', text: 'y = sqrt(x)' }
        ],
        correctAnswer: 'A',
        explanation: 'A linear expression has degree one.',
        knowledgeTags: ['Functions'],
        status: 'draft',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        version: 1
      }],
      issues: []
    }));
    await page.route('**/api/v1/admin/special-practice/topics', (route) => json(route, {
      items: [specialTopic],
      summary: { total: 1, published: 0, draft: 1 }
    }));
    await page.route('**/api/v1/admin/special-practice/topics/201', (route) => json(route, {
      topic: specialTopic,
      questions: [{
        id: 2001,
        topicId: 201,
        orderNumber: 1,
        difficulty: 'Core',
        questionType: 'single-choice',
        prompt: 'Which expression represents a linear function?',
        options: [
          { id: 'A', text: 'y = 2x + 1' },
          { id: 'B', text: 'y = x^2' },
          { id: 'C', text: 'y = 1 / x' },
          { id: 'D', text: 'y = sqrt(x)' }
        ],
        correctAnswer: 'A',
        explanation: 'A linear function has degree one and a constant rate of change.',
        knowledgeTags: ['Functions'],
        status: 'draft',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        version: 1
      }],
      issues: []
    }));
    await page.route('**/api/v1/admin/users', (route) => json(route, {
      items: [
        {
          id: 'admin-1',
          email: 'admin@example.com',
          displayName: 'Admin',
          role: 'admin',
          status: 'active',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z'
        },
        {
          id: 'admin-2',
          email: 'reviewer@example.com',
          displayName: 'Reviewer',
          role: 'admin',
          status: 'disabled',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z'
        }
      ]
    }));

    await page.addInitScript(() => {
      window.localStorage.setItem('cscalite.accessToken', 'admin-token');
    });

    for (const path of ['/admin/audit', '/admin/content', '/admin/timeline-windows', '/admin/city-guides', '/admin/schools', '/admin/scholarships', '/admin/mock-exams', '/admin/special-practice', '/admin/users']) {
      await page.goto(localizedPath('en', path));
      await expect(page.getByText('Audit Overview')).toBeVisible();
      const health = await getVisibleTextHealth(page);
      expect(health.rawKeys, `${path} raw i18n keys`).toEqual([]);
      expect(health.chinese, `${path} visible Chinese text`).toEqual([]);
      expect(health.overflow, `${path} should not overflow horizontally`).toBe(false);
    }
  });
});
