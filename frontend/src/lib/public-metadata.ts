import type { StandaloneRoute } from './standalone-route-policy';

type Metadata = {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
};

const PUBLIC_ORIGIN = 'https://www.cscapilot.com';
const SOCIAL_IMAGE = `${PUBLIC_ORIGIN}/og-cscapilot.png`;

function structuredDataFor(route: StandaloneRoute, locale: string) {
  const isEnglish = locale === 'en';
  const isVietnamese = locale === 'vi';
  const publisher = { '@type': 'Organization', '@id': `${PUBLIC_ORIGIN}/#publisher`, name: 'Holalobe', brand: { '@type': 'Brand', name: 'CSCAPilot' } };
  if (route === 'home') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${PUBLIC_ORIGIN}/#website`, url: `${PUBLIC_ORIGIN}/`, name: 'CSCAPilot', publisher: { '@id': publisher['@id'] } },
        publisher,
        {
          '@type': 'EducationalApplication',
          name: 'CSCAPilot',
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          url: `${PUBLIC_ORIGIN}/`,
          description: isEnglish
            ? 'CSCA learning and practice for mathematics, physics, and chemistry.'
            : isVietnamese
              ? 'Học và luyện CSCA cho Toán, Vật lý và Hóa học.'
              : '面向 CSCA 数学、物理和化学的学习与训练。',
          publisher: { '@id': publisher['@id'] }
        }
      ]
    };
  }
  if (route === 'about') {
    return {
      '@context': 'https://schema.org',
      '@graph': [publisher, {
        '@type': 'AboutPage',
        name: isEnglish ? 'About CSCAPilot' : isVietnamese ? 'Giới thiệu CSCAPilot' : '关于 CSCAPilot',
        url: `${PUBLIC_ORIGIN}/about`,
        isPartOf: { '@id': `${PUBLIC_ORIGIN}/#website` },
        publisher: { '@id': publisher['@id'] }
      }]
    };
  }
  if (route === 'csca-prep') {
    const faq = isEnglish
      ? [
          ['What is CSCA?', 'CSCA is an academic assessment for international undergraduate applicants to China.'],
          ['Which subjects does CSCA include?', 'Common subjects include Chinese, math, physics, and chemistry. Confirm exact requirements with the target school.'],
          ['Can I take CSCA in English?', 'Math, physics, and chemistry are usually available in Chinese or English. Confirm the current official exam notice.']
        ]
      : isVietnamese
        ? [
            ['CSCA là gì?', 'CSCA là bài đánh giá học thuật cho ứng viên quốc tế bậc đại học tại Trung Quốc.'],
            ['CSCA gồm những môn nào?', 'Các môn thường gặp gồm tiếng Trung, Toán, Vật lý và Hóa học. Hãy xác nhận yêu cầu cụ thể với trường mục tiêu.'],
            ['Có thể thi CSCA bằng tiếng Anh không?', 'Toán, Vật lý và Hóa học thường có thể chọn tiếng Trung hoặc tiếng Anh. Hãy xác nhận theo thông báo thi chính thức hiện hành.']
          ]
        : [
            ['什么是 CSCA？', 'CSCA 是面向来华本科国际学生的学业水平测试。'],
            ['CSCA 考哪些科目？', '常见科目包括中文、数学、物理和化学，具体要求需向目标学校确认。'],
            ['CSCA 可以用英文考试吗？', '数学、物理和化学通常可选择中文或英文，请以当次官方考试说明为准。']
          ];
    return {
      '@context': 'https://schema.org',
      '@graph': [
        publisher,
        {
          '@type': 'WebPage',
          name: isEnglish ? 'CSCA Exam Guide and Preparation' : isVietnamese ? 'Hướng dẫn kỳ thi và ôn tập CSCA' : 'CSCA 考试介绍与备考指南',
          url: `${PUBLIC_ORIGIN}/csca-prep`,
          isPartOf: { '@id': `${PUBLIC_ORIGIN}/#website` },
          publisher: { '@id': publisher['@id'] }
        },
        {
          '@type': 'FAQPage',
          mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } }))
        }
      ]
    };
  }
  return null;
}

function metadataFor(route: StandaloneRoute, locale: string): Metadata {
  const isEnglish = locale === 'en';
  const isVietnamese = locale === 'vi';
  if (route === 'csca-prep') {
    return {
      title: isEnglish
        ? 'CSCA Exam Guide and Preparation · CSCAPilot'
        : isVietnamese
          ? 'Hướng dẫn kỳ thi và ôn tập CSCA · CSCAPilot'
          : 'CSCA 考试介绍与备考指南 · CSCAPilot',
      description: isEnglish
        ? 'Understand CSCA math, physics, and chemistry subjects, exam timing, and a practical preparation path.'
        : isVietnamese
          ? 'Tìm hiểu các môn Toán, Vật lý và Hóa học của CSCA, lịch thi và lộ trình ôn tập thực tế.'
          : '了解 CSCA 数学、物理和化学的考试科目、时间与备考路径，并进入 CSCAPilot 学习 Agent。',
      canonicalPath: '/csca-prep',
      robots: 'index,follow'
    };
  }
  if (route === 'about') {
    return {
      title: isEnglish
        ? 'About CSCAPilot · Learning, AI, and Content Sources'
        : isVietnamese
          ? 'Giới thiệu CSCAPilot · Học tập, AI và nguồn nội dung'
          : '关于 CSCAPilot · 学习、AI 与内容来源',
      description: isEnglish
        ? 'Learn what CSCAPilot does, how its Learning Agent uses DeepSeek, and how learning records and question sources are handled.'
        : isVietnamese
          ? 'Tìm hiểu CSCAPilot, cách Trợ lý học tập dùng DeepSeek và cách xử lý dữ liệu học tập cùng nguồn câu hỏi.'
          : '了解 CSCAPilot 的产品边界、学习 Agent 如何使用 DeepSeek，以及学习记录与题目来源的处理方式。',
      canonicalPath: '/about',
      robots: 'index,follow'
    };
  }
  if (route === 'home') {
    return {
      title: isEnglish
        ? 'CSCAPilot · CSCA Learning Agent'
        : isVietnamese
          ? 'CSCAPilot · Trợ lý học tập CSCA'
          : 'CSCAPilot · CSCA 学习 Agent',
      description: isEnglish
        ? 'Use real answers to find weak areas and get the next math, physics, or chemistry practice step.'
        : isVietnamese
          ? 'Dùng bài làm thật để tìm điểm yếu và nhận bước luyện tiếp theo cho Toán, Vật lý hoặc Hóa học.'
          : 'CSCAPilot 是面向 CSCA 数学、物理和化学备考的学习 Agent，用真实作答连接诊断、训练、解析与复盘。',
      canonicalPath: '/',
      robots: 'index,follow'
    };
  }
  const privateTitles: Partial<Record<StandaloneRoute, string>> = {
    agent: isEnglish ? 'Learning Agent · CSCAPilot' : isVietnamese ? 'Trợ lý học tập · CSCAPilot' : '学习 Agent · CSCAPilot',
    auth: isEnglish ? 'Sign in · CSCAPilot' : isVietnamese ? 'Đăng nhập · CSCAPilot' : '登录 · CSCAPilot',
    onboarding: isEnglish ? 'Learning setup · CSCAPilot' : isVietnamese ? 'Thiết lập học tập · CSCAPilot' : '学习设置 · CSCAPilot',
    me: isEnglish ? 'Personal settings · CSCAPilot' : isVietnamese ? 'Cài đặt cá nhân · CSCAPilot' : '个人设置 · CSCAPilot'
  };
  return {
    title: privateTitles[route] ?? 'CSCAPilot',
    description: isEnglish
      ? 'CSCAPilot learning workspace.'
      : isVietnamese
        ? 'Không gian học tập CSCAPilot.'
        : 'CSCAPilot 学习工作区。',
    canonicalPath: route === 'not-found' ? window.location.pathname : `/${route}`,
    robots: 'noindex,nofollow'
  };
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

export function applyPublicMetadata(route: StandaloneRoute, locale: string) {
  const metadata = metadataFor(route, locale);
  const canonical = `${PUBLIC_ORIGIN}${metadata.canonicalPath}`;
  document.title = metadata.title;
  upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: metadata.robots });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'CSCAPilot' });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: SOCIAL_IMAGE });
  upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1731' });
  upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '909' });
  upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: metadata.title });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: metadata.description });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: SOCIAL_IMAGE });

  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonical;

  const existingStructuredData = document.getElementById('cscapilot-structured-data');
  const structuredData = structuredDataFor(route, locale);
  if (!structuredData) {
    existingStructuredData?.remove();
    return;
  }
  const script = existingStructuredData ?? document.createElement('script');
  script.id = 'cscapilot-structured-data';
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(structuredData);
  if (!existingStructuredData) document.head.appendChild(script);
}
