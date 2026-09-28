export type PublicContentBlock = {
  key: string;
  locale?: string;
  requestedLocale?: string;
  isFallback?: boolean;
  title: string;
  subtitle?: string;
  body: Record<string, unknown>;
  updatedAt: string;
};

export type AdminContentBlock = PublicContentBlock & {
  id: string;
  status: string;
  sortOrder: number;
  version: number;
};

export type AdminContentBlockInput = {
  title?: string;
  subtitle?: string | null;
  body?: Record<string, unknown>;
  status?: string;
  sortOrder?: number;
  expectedVersion?: number;
};

export type AdminContentBlockCreateInput = {
  key: string;
  locale?: string;
  title: string;
  subtitle?: string | null;
  body?: Record<string, unknown>;
  status?: string;
  sortOrder?: number;
};

export const DEFAULT_HOME_BLOCKS = [
  {
    key: 'home.hero',
    title: '先做一套模拟题，知道自己差在哪。',
    subtitle: 'CSCA 模拟题与备考练习',
    body: {
      body: '从免费在线模考开始，查看薄弱知识点，再进入数学、物理、化学科目训练；每一轮练习都会沉淀到错题复盘和学习记录。',
      proofPills: ['免费首套模考', '科目训练复盘', 'AI 反馈额度']
    },
    status: 'published',
    sortOrder: 10
  },
  {
    key: 'home.requirements',
    title: '模考不是结束，而是找到下一步。',
    subtitle: '训练路径',
    body: {
      body: '完成一套模拟题后，先看报告里的知识点和错题，再回到科目训练补薄弱项。'
    },
    status: 'published',
    sortOrder: 20
  },
  {
    key: 'home.subjects',
    title: '数学、物理、化学分科推进。',
    subtitle: '科目学习',
    body: {
      body: '每个科目都有学习主页、科目训练和在线模考入口，适合按薄弱点逐步推进。'
    },
    status: 'published',
    sortOrder: 25
  },
  {
    key: 'home.prep',
    title: '先测水平，再安排科目训练。',
    subtitle: '如何准备 CSCA',
    body: {
      body: '用模考判断当前状态，用科目训练补薄弱点，再回到整卷检查速度和稳定性。'
    },
    status: 'published',
    sortOrder: 30
  },
  {
    key: 'home.practice',
    title: '从一次模考，进入一轮复盘。',
    subtitle: '练习路径',
    body: {
      body: '在线模考负责测节奏，报告负责指出薄弱点，科目训练负责把问题拆小。'
    },
    status: 'published',
    sortOrder: 35
  },
  {
    key: 'home.library',
    title: '真题、错题和记录都回到个人主页。',
    subtitle: '学习记录',
    body: {
      body: '练习、模考和错题复盘会自动沉淀到个人主页，帮助你判断下一轮该先处理什么。'
    },
    status: 'published',
    sortOrder: 40
  },
  {
    key: 'home.closing',
    title: '先做一套模拟题，再决定下一轮练什么。',
    subtitle: '现在就可以开始',
    body: {
      body: '先做一套模拟题，再决定下一轮练什么。'
    },
    status: 'published',
    sortOrder: 50
  },
  {
    key: 'csca.exam.schedule',
    title: '2026年6月27日 CSCA 考试安排',
    subtitle: '考试时间与费用',
    body: {
      nextExamDate: '2026-06-27',
      registrationWindow: {
        start: '2026-04-01T12:00:00+08:00',
        end: '2026-04-09T12:00:00+08:00',
        timezone: 'Asia/Shanghai'
      },
      regularScheduleText: '2026年起每年5次：1月、3月、4月、6月、12月',
      scoreReleaseText: '考试后2周内',
      examFormat: {
        mode: '在线机考',
        location: '线上、线下考点',
        delivery: '按科目分时段完成',
        scoreRange: '每科 0-100 分'
      },
      fees: [
        { label: '单科报名', value: '¥450 CNY' },
        { label: '两科及以上', value: '¥700 CNY' },
        { label: '备注', value: '费用以报名系统公布为准' }
      ],
      subjects: [
        { name: '中文（文科）', language: '仅中文', durationMinutes: 90, questions: '50道选择题', scoreRange: '0-100', syllabusItems: ['现代汉语基础', '文学常识与运用', '阅读理解'] },
        { name: '中文（理科）', language: '仅中文', durationMinutes: 90, questions: '50道选择题', scoreRange: '0-100', syllabusItems: ['语言表达', '基础阅读', '学术中文'] },
        { name: '数学', language: '中文或英文', durationMinutes: 60, questions: '48道选择题', scoreRange: '0-100', syllabusItems: ['代数与函数', '解析几何', '概率与统计'] },
        { name: '物理', language: '中文或英文', durationMinutes: 60, questions: '48道选择题', scoreRange: '0-100', syllabusItems: ['力学', '电磁学', '热学与光学'] },
        { name: '化学', language: '中文或英文', durationMinutes: 60, questions: '48道选择题', scoreRange: '0-100', syllabusItems: ['物质结构', '化学反应原理', '有机化学基础'] }
      ],
      sessions: [
        { subject: '专业中文', startsAtBeijing: '2026-06-27T12:00:00+08:00', endsAtBeijing: '2026-06-27T13:30:00+08:00' },
        { subject: '物理', startsAtBeijing: '2026-06-27T15:00:00+08:00', endsAtBeijing: '2026-06-27T16:00:00+08:00' },
        { subject: '数学', startsAtBeijing: '2026-06-27T18:00:00+08:00', endsAtBeijing: '2026-06-27T19:00:00+08:00' },
        { subject: '化学', startsAtBeijing: '2026-06-27T20:30:00+08:00', endsAtBeijing: '2026-06-27T21:30:00+08:00' }
      ],
      sourceUrl: 'https://csca.apply4ch.com/',
      sourceLabel: 'CSCA 官方报名与考试信息',
      lastVerifiedAt: '2026-05-08'
    },
    status: 'published',
    sortOrder: 60
  }
] as const;
