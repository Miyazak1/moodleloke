export type HomeCopy = {
  hero: {
    kicker: string;
    title: string;
    body: string;
  };
  proofPills: string[];
  intro: {
    title: string;
    body: string;
  };
  subjects: {
    title: string;
    body: string;
  };
  prep: {
    title: string;
    body: string;
  };
  practice: {
    title: string;
    body: string;
  };
  library: {
    title: string;
    body: string;
  };
  closing: string;
};
export const HOME_COPY: HomeCopy = {
  hero: {
    kicker: 'CSCA 模拟题与备考练习',
    title: '先做一套模拟题，知道自己差在哪。',
    body: '从免费在线模考开始，查看薄弱知识点，再进入数学、物理、化学科目训练；每一轮练习都会沉淀到错题复盘和学习记录。'
  },
  proofPills: ['免费首套模考', '科目训练复盘', 'AI 反馈额度'],
  intro: {
    title: '模考不是结束，而是找到下一步。',
    body: '完成一套模拟题后，先看报告里的知识点和错题，再回到科目训练补薄弱项。'
  },
  subjects: {
    title: '数学、物理、化学分科推进。',
    body: '每个科目都有学习主页、科目训练和在线模考入口，适合按薄弱点逐步推进。'
  },
  prep: {
    title: '先测水平，再安排科目训练。',
    body: '用模考判断当前状态，用科目训练补薄弱点，再回到整卷检查速度和稳定性。'
  },
  practice: {
    title: '从一次模考，进入一轮复盘。',
    body: '在线模考负责测节奏，报告负责指出薄弱点，科目训练负责把问题拆小。'
  },
  library: {
    title: '真题、错题和记录都回到个人主页。',
    body: '练习、模考和错题复盘会自动沉淀到个人主页，帮助你判断下一轮该先处理什么。'
  },
  closing: '先做一套模拟题，再决定下一轮练什么。'
};

function readText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : fallback;
}

const LEGACY_HOME_COPY_PATTERN = /样题练习|准备判断小测|prep check|sample practice|学校怎么要求|真实学校案例|学校案例|大学不是统一一句|校方招生页面|招生页面|目标学校|目标项目|院校库|奖学金|申请时间表|来华本科|官方附件|授课语言|英文授课|城市指南/i;

function readLegacySafeText(value: unknown, fallback: string) {
  const text = readText(value, fallback);
  return LEGACY_HOME_COPY_PATTERN.test(text) ? fallback : text;
}

function readLegacySafeStringArray(value: unknown, fallback: string[]) {
  const items = readStringArray(value, fallback);
  return LEGACY_HOME_COPY_PATTERN.test(items.join('\n')) ? fallback : items;
}

export function mergeHomeCopyFromBlocks(
  blocks: Array<{
    key: string;
    title: string;
    subtitle?: string;
    body: Record<string, unknown>;
  }>
): HomeCopy {
  const byKey = new Map(blocks.map((block) => [block.key, block] as const));
  const hero = byKey.get('home.hero');
  const requirements = byKey.get('home.requirements');
  const subjects = byKey.get('home.subjects');
  const prep = byKey.get('home.prep');
  const practice = byKey.get('home.practice');
  const library = byKey.get('home.library');
  const closing = byKey.get('home.closing');

  return {
    hero: {
      kicker: readLegacySafeText(hero?.subtitle, HOME_COPY.hero.kicker),
      title: readLegacySafeText(hero?.title, HOME_COPY.hero.title),
      body: readLegacySafeText(hero?.body?.body, HOME_COPY.hero.body)
    },
    proofPills: readLegacySafeStringArray(hero?.body?.proofPills, [...HOME_COPY.proofPills]),
    intro: {
      title: readLegacySafeText(requirements?.title, HOME_COPY.intro.title),
      body: readLegacySafeText(requirements?.body?.body, HOME_COPY.intro.body)
    },
    subjects: {
      title: readLegacySafeText(subjects?.title, HOME_COPY.subjects.title),
      body: readLegacySafeText(subjects?.body?.body, HOME_COPY.subjects.body)
    },
    prep: {
      title: readLegacySafeText(prep?.title, HOME_COPY.prep.title),
      body: readLegacySafeText(prep?.body?.body, HOME_COPY.prep.body)
    },
    practice: {
      title: readLegacySafeText(practice?.title, HOME_COPY.practice.title),
      body: readLegacySafeText(practice?.body?.body, HOME_COPY.practice.body)
    },
    library: {
      title: readLegacySafeText(library?.title, HOME_COPY.library.title),
      body: readLegacySafeText(library?.body?.body, HOME_COPY.library.body)
    },
    closing: readLegacySafeText(closing?.body?.body, HOME_COPY.closing)
  };
}
