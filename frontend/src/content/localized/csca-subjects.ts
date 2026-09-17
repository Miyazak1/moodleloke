import type { LocalizedMap } from '../../i18n/locale-utils';
import type { SpecialPracticeSubject } from '../../lib/api-types';

type SubjectRecommendationCopy = {
  nextModule: LocalizedMap<string>;
  nextReason: LocalizedMap<string>;
  routeLabel: LocalizedMap<string>;
};

export type LocalizedSubjectCopy = {
  title: string;
  subtitle: string;
  body: string;
  modules: Array<{ title: string; body: string; tags: string[]; hours: number }>;
  tips: Array<{ label: string; title: string; body: string }>;
};

export const CSCA_SUBJECT_LABELS: LocalizedMap<Record<SpecialPracticeSubject, string>> = {
  'zh-CN': {
    math: '数学',
    physics: '物理',
    chemistry: '化学'
  },
  en: {
    math: 'Math',
    physics: 'Physics',
    chemistry: 'Chemistry'
  },
  vi: {
    math: 'Toán',
    physics: 'Vật lý',
    chemistry: 'Hóa học'
  }
};

export function cscaSubjectLabel(subject: string, locale: string, fallback = subject) {
  const labels = CSCA_SUBJECT_LABELS[locale as keyof typeof CSCA_SUBJECT_LABELS] ?? CSCA_SUBJECT_LABELS['zh-CN'];
  return labels[subject as SpecialPracticeSubject] ?? fallback;
}

type CscaSecondaryLocale = 'en' | 'vi';

export const CSCA_MONTH_LABELS: Partial<Record<CscaSecondaryLocale, Record<string, string>>> = {
  en: {
    '1月': 'January',
    '2月': 'February',
    '3月': 'March',
    '4月': 'April',
    '5月': 'May',
    '6月': 'June',
    '7月': 'July',
    '8月': 'August',
    '9月': 'September',
    '10月': 'October',
    '11月': 'November',
    '12月': 'December'
  }
};

export const CSCA_RESOURCE_TAG_LABELS: Partial<Record<CscaSecondaryLocale, Record<string, string>>> = {
  en: {
    中文: 'Chinese',
    含答案: 'Answers included',
    '原卷 PDF': 'Paper PDF',
    '真题原卷 PDF': 'Past paper PDF',
    含解析: 'Solutions included',
    免费下载: 'Free download'
  },
  vi: {
    中文: 'Tiếng Trung',
    含答案: 'Có đáp án',
    '原卷 PDF': 'PDF đề gốc',
    '真题原卷 PDF': 'PDF đề thật',
    含解析: 'Có lời giải',
    免费下载: 'Tải miễn phí',
    English: 'Tiếng Anh',
    Chinese: 'Tiếng Trung',
    'Answers included': 'Có đáp án',
    'Paper PDF': 'PDF đề gốc',
    'Solutions included': 'Có lời giải',
    'Free download': 'Tải miễn phí'
  }
};

export const CSCA_RESOURCE_FILE_KIND_LABELS: Partial<Record<CscaSecondaryLocale, Record<string, string>>> = {
  en: {
    paper: 'Paper PDF',
    answers: 'Answers PDF',
    solutions: 'Answers and Solutions PDF',
    'mark-scheme': 'Mark Scheme PDF',
    cover: 'Cover'
  },
  vi: {
    paper: 'PDF đề gốc',
    answers: 'PDF đáp án',
    solutions: 'PDF đáp án và lời giải',
    'mark-scheme': 'PDF thang điểm',
    cover: 'Bìa'
  }
};

export function cscaLocalizedResourceLabel(labels: Partial<Record<CscaSecondaryLocale, Record<string, string>>>, value: string, locale: string) {
  return labels[locale as keyof typeof labels]?.[value] ?? value;
}

export const CSCA_PRACTICE_MODULE_LABELS: Partial<Record<CscaSecondaryLocale, Record<string, string>>> = {
  en: {
    集合与不等式: 'Sets and Inequalities',
    函数: 'Functions',
    几何与代数: 'Geometry and Algebra',
    概率与统计: 'Probability and Statistics',
    力学: 'Mechanics',
    电磁学: 'Electromagnetism',
    波动与光学: 'Waves and Optics',
    热学: 'Thermal Physics',
    近代物理: 'Modern Physics',
    物质结构: 'Structure of Matter',
    基础概念: 'Basic Concepts',
    反应原理: 'Reaction Principles',
    溶液化学: 'Solution Chemistry',
    物质与应用: 'Substances and Applications'
  },
  vi: {
    集合与不等式: 'Tập hợp và bất đẳng thức',
    函数: 'Hàm số',
    几何与代数: 'Hình học và đại số',
    概率与统计: 'Xác suất và thống kê',
    力学: 'Cơ học',
    电磁学: 'Điện từ học',
    波动与光学: 'Sóng và quang học',
    热学: 'Nhiệt học',
    近代物理: 'Vật lý hiện đại',
    物质结构: 'Cấu trúc vật chất',
    基础概念: 'Khái niệm cơ bản',
    反应原理: 'Nguyên lý phản ứng',
    溶液化学: 'Hóa học dung dịch',
    物质与应用: 'Chất và ứng dụng'
  }
};

export const CSCA_PRACTICE_TOPIC_LABELS: Partial<Record<CscaSecondaryLocale, Record<string, string>>> = {
  en: {
    'math-function-basic': 'Elementary Functions',
    'math-sequence': 'Sequences',
    'math-function': 'Functions',
    'math-calculus': 'Derivatives and Calculus',
    'math-plane-geometry': 'Plane Analytic Geometry',
    'math-solid-vector': 'Vectors',
    'math-complex': 'Complex Numbers',
    'math-solid-geometry': 'Solid Geometry',
    'math-coordinate-geometry': 'Three-Dimensional Coordinates',
    'math-inequality': 'Inequalities',
    'math-set': 'Sets',
    'math-probability': 'Probability and Statistics',
    'physics-force': "Newton's Laws of Motion",
    'physics-motion': 'Kinematics',
    'physics-work-energy': 'Work and Energy',
    'physics-circular-gravity': 'Circular Motion and Gravitation',
    'physics-momentum': 'Momentum and Impulse',
    'physics-electrostatic-field': 'Electrostatic Fields',
    'physics-magnetic': 'Magnetic Fields',
    'physics-circuit': 'DC Circuits',
    'physics-electromagnetic-induction': 'Electromagnetic Induction',
    'physics-harmonic-wave': 'Simple Harmonic Motion and Mechanical Waves',
    'physics-geometric-optics': 'Geometric Optics',
    'physics-physical-optics': 'Physical Optics',
    'physics-optics': 'Optics',
    'physics-ideal-gas': 'Ideal Gas Law',
    'physics-molecular-kinetic': 'Molecular Kinetic Theory',
    'physics-thermodynamics-first-law': 'First Law of Thermodynamics',
    'physics-thermal': 'Thermal Physics',
    'physics-photoelectric-effect': 'Photoelectric Effect',
    'physics-atomic': 'Atomic Structure',
    'physics-nuclear': 'Nuclear Physics Basics',
    'physics-modern': 'Modern Physics',
    'chemistry-amount-calculation': 'Amount-of-Substance Calculations',
    'chemistry-classification-state': 'Classification of Matter and State Changes',
    'chemistry-atomic-structure': 'Atomic Structure and Periodic Trends',
    'chemistry-chemical-bonding': 'Chemical Bonding and Intermolecular Forces',
    'chemistry-notation-equation': 'Chemical Notation and Equations',
    'chemistry-redox': 'Redox Reactions',
    'chemistry-ion': 'Ionic Reactions and Tests',
    'chemistry-equilibrium': 'Reaction Rate and Equilibrium',
    'chemistry-electrolyte-solution': 'Electrolyte Solution Theory',
    'chemistry-concentration-ph': 'Solution Concentration and pH',
    'chemistry-ideal-gas': 'Ideal Gas Law',
    'chemistry-inorganic-properties': 'Properties of Common Inorganic Substances',
    'chemistry-organic-basic': 'Basic Organic Compounds',
    'chemistry-experiment-application': 'Chemistry Experiments and Applications',
    'chemistry-industrial-process': 'Industrial Chemical Processes'
  },
  vi: {
    'math-function-basic': 'Hàm sơ cấp',
    'math-sequence': 'Dãy số',
    'math-function': 'Hàm số',
    'math-calculus': 'Đạo hàm và giải tích',
    'math-plane-geometry': 'Hình học giải tích phẳng',
    'math-solid-vector': 'Vectơ',
    'math-complex': 'Số phức',
    'math-solid-geometry': 'Hình học không gian',
    'math-coordinate-geometry': 'Tọa độ 3D',
    'math-inequality': 'Bất đẳng thức',
    'math-set': 'Tập hợp',
    'math-probability': 'Xác suất và thống kê',
    'physics-force': 'Định luật Newton',
    'physics-motion': 'Động học',
    'physics-work-energy': 'Công và năng lượng',
    'physics-circular-gravity': 'Chuyển động tròn và hấp dẫn',
    'physics-momentum': 'Động lượng và xung lượng',
    'physics-electrostatic-field': 'Điện trường tĩnh',
    'physics-magnetic': 'Từ trường',
    'physics-circuit': 'Mạch điện một chiều',
    'physics-electromagnetic-induction': 'Cảm ứng điện từ',
    'physics-harmonic-wave': 'Dao động điều hòa và sóng cơ',
    'physics-geometric-optics': 'Quang hình học',
    'physics-physical-optics': 'Quang sóng',
    'physics-optics': 'Quang học',
    'physics-ideal-gas': 'Phương trình khí lý tưởng',
    'physics-molecular-kinetic': 'Thuyết động học phân tử',
    'physics-thermodynamics-first-law': 'Định luật I nhiệt động lực học',
    'physics-thermal': 'Nhiệt học',
    'physics-photoelectric-effect': 'Hiệu ứng quang điện',
    'physics-atomic': 'Cấu trúc nguyên tử',
    'physics-nuclear': 'Cơ sở vật lý hạt nhân',
    'physics-modern': 'Vật lý hiện đại',
    'chemistry-amount-calculation': 'Tính toán lượng chất',
    'chemistry-classification-state': 'Phân loại chất và biến đổi trạng thái',
    'chemistry-atomic-structure': 'Cấu trúc nguyên tử và xu hướng tuần hoàn',
    'chemistry-chemical-bonding': 'Liên kết hóa học và lực liên phân tử',
    'chemistry-notation-equation': 'Ký hiệu và phương trình hóa học',
    'chemistry-redox': 'Phản ứng oxi hóa khử',
    'chemistry-ion': 'Phản ứng ion và nhận biết',
    'chemistry-equilibrium': 'Tốc độ phản ứng và cân bằng',
    'chemistry-electrolyte-solution': 'Lý thuyết dung dịch điện ly',
    'chemistry-concentration-ph': 'Nồng độ dung dịch và pH',
    'chemistry-ideal-gas': 'Định luật khí lý tưởng',
    'chemistry-inorganic-properties': 'Tính chất chất vô cơ thường gặp',
    'chemistry-organic-basic': 'Hợp chất hữu cơ cơ bản',
    'chemistry-experiment-application': 'Thí nghiệm và ứng dụng hóa học',
    'chemistry-industrial-process': 'Quá trình hóa học công nghiệp'
  }
};

export const CSCA_SUBJECT_RECOMMENDATIONS: Record<SpecialPracticeSubject, SubjectRecommendationCopy> = {
  math: {
    nextModule: { 'zh-CN': '函数', en: 'Functions', vi: 'Hàm số' },
    nextReason: { 'zh-CN': '高频且容易在定义域、图像变换和条件判断上失分。', en: 'High-frequency topic with common mistakes in domain, graph changes, and conditions.', vi: 'Chủ đề xuất hiện nhiều, dễ mất điểm ở miền xác định, biến đổi đồ thị và điều kiện.' },
    routeLabel: { 'zh-CN': '图像/公式联动', en: 'Visual + formula ready', vi: 'Liên kết đồ thị + công thức' }
  },
  physics: {
    nextModule: { 'zh-CN': '力学', en: 'Mechanics', vi: 'Cơ học' },
    nextReason: { 'zh-CN': '先稳定受力、运动、能量和单位方向，再进入电磁与整卷。', en: 'Stabilize force, motion, energy, units, and direction before electromagnetism and full papers.', vi: 'Ổn định lực, chuyển động, năng lượng, đơn vị và hướng trước khi sang điện từ và đề đầy đủ.' },
    routeLabel: { 'zh-CN': '模型/单位优先', en: 'Model + units first', vi: 'Ưu tiên mô hình + đơn vị' }
  },
  chemistry: {
    nextModule: { 'zh-CN': '核心概念', en: 'Core Concepts', vi: 'Khái niệm cốt lõi' },
    nextReason: { 'zh-CN': '先理清物质分类、化学语言和物质的量，后续反应与计算会更稳。', en: 'Start with matter classification, chemical language, and mole concepts before reactions and calculations.', vi: 'Bắt đầu từ phân loại chất, ngôn ngữ hóa học và khái niệm mol trước khi làm phản ứng và tính toán.' },
    routeLabel: { 'zh-CN': '反应/计算衔接', en: 'Reaction + calculation ready', vi: 'Nối phản ứng + tính toán' }
  }
};

export const CSCA_SUBJECT_COPY: Partial<Record<'en' | 'vi', Record<SpecialPracticeSubject, LocalizedSubjectCopy>>> = {
  en: {
    math: {
      title: 'CSCA Math',
      subtitle: 'Build core methods first, then check speed with a full mock exam.',
      body: 'Use this page to move between vocabulary, formulas, subject practice, visual tools, and mock exams. The goal is to turn weak topics into a clear practice path.',
      modules: [
        { title: 'Sets and Inequalities', body: 'Stabilize set notation, operations, complements, intervals, and basic inequality solving.', tags: ['sets', 'inequalities', 'intervals'], hours: 10 },
        { title: 'Functions', body: 'Review domains, graphs, transformations, monotonicity, and elementary functions.', tags: ['domain', 'graphs', 'transformations'], hours: 16 },
        { title: 'Geometry and Algebra', body: 'Connect vectors, coordinate geometry, and spatial relationships with diagrams.', tags: ['vectors', 'coordinates', 'geometry'], hours: 20 },
        { title: 'Probability and Statistics', body: 'Practice counting, probability models, and data summaries before mixed papers.', tags: ['probability', 'counting', 'statistics'], hours: 12 }
      ],
      tips: [
        { label: 'First step', title: 'Start with one focused topic.', body: 'A short topic reveals gaps faster than reading the full outline.' },
        { label: 'Common trap', title: 'Check conditions before formulas.', body: 'Domain, graph constraints, and sample space often decide the answer.' },
        { label: 'Mock timing', title: 'Use the mock after targeted review.', body: 'A 48-question timed paper is most useful after one round of weak-topic practice.' }
      ]
    },
    physics: {
      title: 'CSCA Physics',
      subtitle: 'Understand models, units, and diagrams before full-paper timing.',
      body: 'Physics prep works best when formulas, directions, units, and graphs stay together. Start with mechanics and electromagnetism, then use mock exams to test reading speed.',
      modules: [
        { title: 'Mechanics', body: 'Review forces, motion, work, energy, momentum, and conservation models.', tags: ['forces', 'motion', 'energy'], hours: 18 },
        { title: 'Electricity and Magnetism', body: 'Separate circuits, fields, magnetic force, and induction conditions.', tags: ['circuits', 'fields', 'magnetism'], hours: 18 },
        { title: 'Thermal Physics', body: 'Clarify heat, temperature, gases, and energy-transfer boundaries.', tags: ['heat', 'gases', 'energy'], hours: 10 },
        { title: 'Waves and Optics', body: 'Read wave graphs, ray diagrams, reflection, refraction, and image conditions.', tags: ['waves', 'optics', 'graphs'], hours: 10 },
        { title: 'Modern Physics', body: 'Review atomic structure, energy levels, radioactivity, and nuclear reactions.', tags: ['atoms', 'nuclear', 'energy levels'], hours: 8 }
      ],
      tips: [
        { label: 'First step', title: 'Draw the physical situation.', body: 'Most physics errors come from missed direction, units, or conditions.' },
        { label: 'Common trap', title: 'Formula choice depends on context.', body: 'Mark what the problem gives before substituting values.' },
        { label: 'Mock timing', title: 'Use mocks to test reading speed.', body: 'A timed paper shows whether model recognition is fast enough.' }
      ]
    },
    chemistry: {
      title: 'CSCA Chemistry',
      subtitle: 'Organize structure, reactions, and calculations before switching to full papers.',
      body: 'Chemistry prep links concepts, reaction rules, solution calculations, organic patterns, and experimental judgment. Use subject practice to stabilize each group.',
      modules: [
        { title: 'Core Concepts', body: 'Review matter classification, chemical language, moles, and lab basics.', tags: ['matter', 'moles', 'lab'], hours: 12 },
        { title: 'Inorganic Chemistry', body: 'Build the framework for atomic structure, periodic trends, bonds, and common substances.', tags: ['atoms', 'periodic trends', 'bonds'], hours: 14 },
        { title: 'Organic Chemistry', body: 'Connect functional groups, isomers, and typical reaction patterns.', tags: ['organic', 'functional groups', 'reactions'], hours: 16 },
        { title: 'Physical Chemistry', body: 'Practice redox, equilibrium, rate, energy, and quantitative relationships.', tags: ['equilibrium', 'redox', 'rate'], hours: 20 }
      ],
      tips: [
        { label: 'First step', title: 'Classify the knowledge area first.', body: 'Decide whether the question is concept, inorganic, organic, or calculation before choosing a method.' },
        { label: 'Common trap', title: 'Reaction conditions matter.', body: 'Many mistakes come from missing conditions, direction, or observations.' },
        { label: 'Mock timing', title: 'Use mocks to test topic switching.', body: 'Chemistry papers often test how quickly you move between different question types.' }
      ]
    }
  },
  vi: {
    math: {
      title: 'CSCA Toán',
      subtitle: 'Xây nền phương pháp trước, sau đó kiểm tra tốc độ bằng bài thi thử trực tuyến đầy đủ.',
      body: 'Dùng trang này để di chuyển giữa từ vựng, công thức, luyện theo môn, công cụ trực quan và thi thử. Mục tiêu là biến điểm yếu thành một lộ trình luyện tập rõ ràng.',
      modules: [
        { title: 'Tập hợp và bất đẳng thức', body: 'Ổn định ký hiệu tập hợp, phép toán, phần bù, khoảng và cách giải bất đẳng thức cơ bản.', tags: ['tập hợp', 'bất đẳng thức', 'khoảng'], hours: 10 },
        { title: 'Hàm số', body: 'Ôn miền xác định, đồ thị, phép biến đổi, tính đơn điệu và các hàm sơ cấp.', tags: ['miền xác định', 'đồ thị', 'biến đổi'], hours: 16 },
        { title: 'Hình học và đại số', body: 'Liên kết vectơ, hình học tọa độ và quan hệ không gian với sơ đồ.', tags: ['vectơ', 'tọa độ', 'hình học'], hours: 20 },
        { title: 'Xác suất và thống kê', body: 'Luyện đếm, mô hình xác suất và tóm tắt dữ liệu trước khi làm đề trộn.', tags: ['xác suất', 'đếm', 'thống kê'], hours: 12 }
      ],
      tips: [
        { label: 'Bước đầu', title: 'Bắt đầu với một chủ đề hẹp.', body: 'Một chủ đề ngắn thường làm lộ lỗ hổng nhanh hơn đọc toàn bộ đề cương.' },
        { label: 'Bẫy thường gặp', title: 'Kiểm tra điều kiện trước công thức.', body: 'Miền xác định, ràng buộc đồ thị và không gian mẫu thường quyết định đáp án.' },
        { label: 'Canh thời gian', title: 'Dùng bài thi thử sau khi ôn trọng điểm.', body: 'Một bài 48 câu có bấm giờ hữu ích nhất sau một vòng luyện điểm yếu.' }
      ]
    },
    physics: {
      title: 'CSCA Vật lý',
      subtitle: 'Hiểu mô hình, đơn vị và sơ đồ trước khi luyện tốc độ làm đề đầy đủ.',
      body: 'Ôn Vật lý hiệu quả nhất khi công thức, hướng, đơn vị và đồ thị luôn đi cùng nhau. Bắt đầu từ cơ học và điện từ, rồi dùng bài thi thử để kiểm tra tốc độ đọc đề.',
      modules: [
        { title: 'Cơ học', body: 'Ôn lực, chuyển động, công, năng lượng, động lượng và các mô hình bảo toàn.', tags: ['lực', 'chuyển động', 'năng lượng'], hours: 18 },
        { title: 'Điện và từ', body: 'Tách rõ mạch điện, điện trường, lực từ và điều kiện cảm ứng.', tags: ['mạch điện', 'trường', 'từ học'], hours: 18 },
        { title: 'Nhiệt học', body: 'Làm rõ nhiệt lượng, nhiệt độ, chất khí và ranh giới truyền năng lượng.', tags: ['nhiệt', 'khí', 'năng lượng'], hours: 10 },
        { title: 'Sóng và quang học', body: 'Đọc đồ thị sóng, sơ đồ tia, phản xạ, khúc xạ và điều kiện tạo ảnh.', tags: ['sóng', 'quang học', 'đồ thị'], hours: 10 },
        { title: 'Vật lý hiện đại', body: 'Ôn cấu trúc nguyên tử, mức năng lượng, phóng xạ và phản ứng hạt nhân.', tags: ['nguyên tử', 'hạt nhân', 'mức năng lượng'], hours: 8 }
      ],
      tips: [
        { label: 'Bước đầu', title: 'Vẽ tình huống vật lý.', body: 'Phần lớn lỗi Vật lý đến từ thiếu hướng, đơn vị hoặc điều kiện.' },
        { label: 'Bẫy thường gặp', title: 'Chọn công thức theo ngữ cảnh.', body: 'Đánh dấu dữ kiện đề bài cho trước trước khi thay số.' },
        { label: 'Canh thời gian', title: 'Dùng bài thi thử để kiểm tra tốc độ đọc.', body: 'Bài có bấm giờ cho thấy bạn nhận ra mô hình đủ nhanh hay chưa.' }
      ]
    },
    chemistry: {
      title: 'CSCA Hóa học',
      subtitle: 'Sắp xếp cấu trúc, phản ứng và tính toán trước khi chuyển sang đề đầy đủ.',
      body: 'Ôn Hóa học cần nối khái niệm, quy tắc phản ứng, tính toán dung dịch, mẫu hình hữu cơ và phán đoán thí nghiệm. Dùng luyện theo môn để ổn định từng nhóm kiến thức.',
      modules: [
        { title: 'Khái niệm cốt lõi', body: 'Ôn phân loại chất, ngôn ngữ hóa học, mol và kiến thức phòng thí nghiệm cơ bản.', tags: ['chất', 'mol', 'thí nghiệm'], hours: 12 },
        { title: 'Hóa vô cơ', body: 'Xây khung cho cấu trúc nguyên tử, xu hướng tuần hoàn, liên kết và các chất thường gặp.', tags: ['nguyên tử', 'tuần hoàn', 'liên kết'], hours: 14 },
        { title: 'Hóa hữu cơ', body: 'Liên kết nhóm chức, đồng phân và các mẫu phản ứng điển hình.', tags: ['hữu cơ', 'nhóm chức', 'phản ứng'], hours: 16 },
        { title: 'Hóa lý', body: 'Luyện oxi hóa khử, cân bằng, tốc độ, năng lượng và quan hệ định lượng.', tags: ['cân bằng', 'oxi hóa khử', 'tốc độ'], hours: 20 }
      ],
      tips: [
        { label: 'Bước đầu', title: 'Phân loại vùng kiến thức trước.', body: 'Quyết định câu hỏi thuộc khái niệm, vô cơ, hữu cơ hay tính toán trước khi chọn cách làm.' },
        { label: 'Bẫy thường gặp', title: 'Điều kiện phản ứng rất quan trọng.', body: 'Nhiều lỗi đến từ bỏ sót điều kiện, chiều phản ứng hoặc hiện tượng quan sát.' },
        { label: 'Canh thời gian', title: 'Dùng bài thi thử để kiểm tra chuyển chủ đề.', body: 'Bài Hóa thường kiểm tra tốc độ chuyển giữa nhiều dạng câu hỏi khác nhau.' }
      ]
    }
  }
};
