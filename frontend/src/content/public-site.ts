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
    kicker: 'CSCA 学习诊断与科目训练',
    title: '先完成一次诊断，知道下一步练什么。',
    body: '进入学习 Agent，用真实作答查看薄弱知识点，再继续数学、物理、化学科目训练；每一轮练习都会沉淀到错题复盘和学习记录。'
  },
  proofPills: ['免费快速诊断', '科目训练复盘', 'AI 反馈额度'],
  intro: {
    title: '诊断不是结束，而是找到下一步。',
    body: '完成一轮真实题诊断后，先看报告里的知识点和错题，再回到科目训练补薄弱项。'
  },
  subjects: {
    title: '数学、物理、化学分科推进。',
    body: '每个科目都由同一个学习 Agent 组织训练、解析和复盘，适合按薄弱点逐步推进。'
  },
  prep: {
    title: '先用真实作答诊断，再安排科目训练。',
    body: '用快速诊断判断当前状态，再由学习 Agent 安排科目训练、错题复盘和下一轮验证。'
  },
  practice: {
    title: '从一次诊断，进入一轮复盘。',
    body: '真实作答负责提供证据，报告负责指出薄弱点，科目训练负责把问题拆小。'
  },
  library: {
    title: '真题、错题和记录都回到个人主页。',
    body: '练习、诊断和错题复盘会自动沉淀到个人主页，帮助你判断下一轮该先处理什么。'
  },
  closing: '进入学习 Agent，用一次真实诊断找到下一步。'
};

const HOME_COPY_EN: HomeCopy = {
  hero: {
    kicker: 'CSCA learning diagnosis and focused practice',
    title: 'Start with one diagnosis. Know what to practise next.',
    body: 'Enter the Learning Agent, use real answers to review weak topics, then continue with focused math, physics, and chemistry practice. Every round feeds your mistake review and learning record.'
  },
  proofPills: ['Free quick diagnosis', 'Subject-by-subject review', 'AI feedback credits'],
  intro: {
    title: 'A diagnosis is not the finish line. It reveals the next step.',
    body: 'After each diagnostic round, review weak topics and mistakes, then return to focused subject practice.'
  },
  subjects: {
    title: 'Progress separately in math, physics, and chemistry.',
    body: 'One Learning Agent organizes practice, explanations, and review for every subject so you can work through weak areas step by step.'
  },
  prep: {
    title: 'Diagnose with real answers, then plan subject practice.',
    body: 'Use a quick diagnosis to understand your current state, then let the Learning Agent organize practice, mistake review, and the next verification round.'
  },
  practice: {
    title: 'Turn every diagnosis into a review cycle.',
    body: 'Real answers provide evidence, reports identify weak points, and subject practice breaks each problem into a manageable next step.'
  },
  library: {
    title: 'Past papers, mistakes, and records return to your dashboard.',
    body: 'Practice, diagnosis, and mistake review are saved together so you can decide what to work on next.'
  },
  closing: 'Enter the Learning Agent and use one real diagnosis to find the next step.'
};

const VI_HOME_COPY: HomeCopy = {
  hero: {
    kicker: 'Chẩn đoán học tập CSCA và luyện tập trọng tâm',
    title: 'Bắt đầu bằng một lần chẩn đoán để biết nên luyện gì tiếp theo.',
    body: 'Vào Trợ lý học tập, dùng bài làm thật để xem kiến thức yếu rồi tiếp tục luyện Toán, Vật lý và Hóa học. Mỗi vòng đều được lưu vào phần ôn câu sai và hồ sơ học tập.'
  },
  proofPills: ['Chẩn đoán nhanh miễn phí', 'Ôn riêng từng môn', 'Credit phản hồi AI'],
  intro: {
    title: 'Chẩn đoán không phải điểm kết thúc mà là cách tìm bước tiếp theo.',
    body: 'Sau mỗi vòng chẩn đoán, xem kiến thức yếu và câu sai rồi quay lại luyện theo môn.'
  },
  subjects: {
    title: 'Tiến bộ riêng theo Toán, Vật lý và Hóa học.',
    body: 'Một Trợ lý học tập tổ chức bài luyện, lời giải và ôn tập cho mọi môn để bạn xử lý từng điểm yếu.'
  },
  prep: {
    title: 'Chẩn đoán bằng bài làm thật, rồi sắp xếp luyện theo môn.',
    body: 'Dùng chẩn đoán nhanh để hiểu trạng thái hiện tại, sau đó để Trợ lý học tập sắp xếp luyện tập, ôn câu sai và vòng xác minh tiếp theo.'
  },
  practice: {
    title: 'Biến mỗi lần chẩn đoán thành một vòng ôn tập.',
    body: 'Bài làm thật cung cấp bằng chứng, báo cáo chỉ ra điểm yếu, còn luyện theo môn chia vấn đề thành bước tiếp theo vừa sức.'
  },
  library: {
    title: 'Đề thật, câu sai và lịch sử đều trở về trang cá nhân.',
    body: 'Bài luyện, chẩn đoán và ôn câu sai được lưu cùng nhau để bạn biết vòng sau nên làm gì trước.'
  },
  closing: 'Vào Trợ lý học tập và dùng một lần chẩn đoán thật để tìm bước tiếp theo.'
};

export function getHomeCopy(locale: string): HomeCopy {
  if (locale === 'en') return HOME_COPY_EN;
  if (locale === 'vi') return VI_HOME_COPY;
  return HOME_COPY;
}

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
  }>,
  fallbackCopy: HomeCopy = HOME_COPY
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
      kicker: readLegacySafeText(hero?.subtitle, fallbackCopy.hero.kicker),
      title: readLegacySafeText(hero?.title, fallbackCopy.hero.title),
      body: readLegacySafeText(hero?.body?.body, fallbackCopy.hero.body)
    },
    proofPills: readLegacySafeStringArray(hero?.body?.proofPills, [...fallbackCopy.proofPills]),
    intro: {
      title: readLegacySafeText(requirements?.title, fallbackCopy.intro.title),
      body: readLegacySafeText(requirements?.body?.body, fallbackCopy.intro.body)
    },
    subjects: {
      title: readLegacySafeText(subjects?.title, fallbackCopy.subjects.title),
      body: readLegacySafeText(subjects?.body?.body, fallbackCopy.subjects.body)
    },
    prep: {
      title: readLegacySafeText(prep?.title, fallbackCopy.prep.title),
      body: readLegacySafeText(prep?.body?.body, fallbackCopy.prep.body)
    },
    practice: {
      title: readLegacySafeText(practice?.title, fallbackCopy.practice.title),
      body: readLegacySafeText(practice?.body?.body, fallbackCopy.practice.body)
    },
    library: {
      title: readLegacySafeText(library?.title, fallbackCopy.library.title),
      body: readLegacySafeText(library?.body?.body, fallbackCopy.library.body)
    },
    closing: readLegacySafeText(closing?.body?.body, fallbackCopy.closing)
  };
}
