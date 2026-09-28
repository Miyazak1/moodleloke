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

const EN_HOME_COPY: HomeCopy = {
  hero: {
    kicker: 'CSCA mock exams and focused practice',
    title: 'Take one mock first. See exactly what to improve.',
    body: 'Start with a free online mock, review weak topics, then move into focused math, physics, and chemistry practice. Every round feeds your mistake review and learning record.'
  },
  proofPills: ['First mock free', 'Subject-by-subject review', 'AI feedback credits'],
  intro: {
    title: 'A mock is not the finish line. It reveals the next step.',
    body: 'After each mock, review weak topics and mistakes, then return to focused subject practice.'
  },
  subjects: {
    title: 'Progress separately in math, physics, and chemistry.',
    body: 'Each subject has its own learning space, focused practice, and mock entry point so you can work through weak areas step by step.'
  },
  prep: {
    title: 'Measure your level first, then plan subject practice.',
    body: 'Use mocks to understand your current level, repair weak areas with subject practice, then return to a full paper to check speed and consistency.'
  },
  practice: {
    title: 'Turn every mock into a review cycle.',
    body: 'Mocks measure pace, reports identify weak points, and subject practice breaks each problem into a manageable next step.'
  },
  library: {
    title: 'Past papers, mistakes, and records return to your dashboard.',
    body: 'Practice, mock exams, and mistake review are saved together so you can decide what to work on next.'
  },
  closing: 'Take one mock, then choose the right focus for your next round.'
};

const VI_HOME_COPY: HomeCopy = {
  hero: {
    kicker: 'Thi thử CSCA và luyện tập trọng tâm',
    title: 'Làm một đề thi thử trước để biết chính xác cần cải thiện gì.',
    body: 'Bắt đầu bằng bài thi thử trực tuyến miễn phí, xem kiến thức yếu rồi chuyển sang luyện Toán, Vật lý và Hóa học. Mỗi vòng đều được lưu vào phần ôn câu sai và hồ sơ học tập.'
  },
  proofPills: ['Miễn phí đề đầu tiên', 'Ôn riêng từng môn', 'Credit phản hồi AI'],
  intro: {
    title: 'Thi thử không phải điểm kết thúc mà là cách tìm bước tiếp theo.',
    body: 'Sau mỗi bài thi thử, xem kiến thức yếu và câu sai rồi quay lại luyện theo môn.'
  },
  subjects: {
    title: 'Tiến bộ riêng theo Toán, Vật lý và Hóa học.',
    body: 'Mỗi môn có không gian học, bài luyện và lối vào thi thử riêng để bạn xử lý từng điểm yếu.'
  },
  prep: {
    title: 'Đo trình độ trước, rồi sắp xếp luyện theo môn.',
    body: 'Dùng thi thử để hiểu trạng thái hiện tại, luyện theo môn để bù điểm yếu, rồi quay lại đề đầy đủ để kiểm tra tốc độ và độ ổn định.'
  },
  practice: {
    title: 'Biến mỗi bài thi thử thành một vòng ôn tập.',
    body: 'Thi thử đo nhịp làm bài, báo cáo chỉ ra điểm yếu, còn luyện theo môn chia vấn đề thành bước tiếp theo vừa sức.'
  },
  library: {
    title: 'Đề thật, câu sai và lịch sử đều trở về trang cá nhân.',
    body: 'Bài luyện, thi thử và ôn câu sai được lưu cùng nhau để bạn biết vòng sau nên làm gì trước.'
  },
  closing: 'Làm một đề thi thử, rồi chọn đúng trọng tâm cho vòng tiếp theo.'
};

export function getHomeCopy(locale: string): HomeCopy {
  if (locale === 'en') return EN_HOME_COPY;
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
