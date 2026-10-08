import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(import.meta.dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const source = fs.readFileSync(indexPath, 'utf8');

const routes = [
  {
    pathname: '/about',
    title: '关于 CSCAPilot · 学习、AI 与内容来源',
    description: '了解 CSCAPilot 的产品边界、学习 Agent 如何使用 DeepSeek，以及学习记录与题目来源的处理方式。',
    body: '<main aria-label="关于 CSCAPilot"><h1>关于 CSCAPilot</h1><p>CSCAPilot 是 Holalobe 旗下的 CSCA 学习产品，通过诊断、练习、解析与复盘帮助学习者安排下一步。</p><p>CSCAPilot 是独立学习与备考工具，不是 CSCA 官方报名网站。考试日期、费用和规则请以官方发布为准。</p><p><a href="/">返回 CSCAPilot</a> · <a href="/agent">进入学习 Agent</a></p></main>',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': 'https://www.cscapilot.com/#publisher', name: 'Holalobe', brand: { '@type': 'Brand', name: 'CSCAPilot' } },
        { '@type': 'AboutPage', name: '关于 CSCAPilot', url: 'https://www.cscapilot.com/about', isPartOf: { '@id': 'https://www.cscapilot.com/#website' }, publisher: { '@id': 'https://www.cscapilot.com/#publisher' } }
      ]
    }
  },
  {
    pathname: '/csca-prep',
    title: 'CSCA 考试介绍与备考指南 · CSCAPilot',
    description: '了解 CSCA 数学、物理和化学的考试科目、时间与备考路径，并进入 CSCAPilot 学习 Agent。',
    body: '<main aria-label="CSCA 考试介绍"><h1>CSCA 考试介绍与备考指南</h1><p>了解数学、物理和化学考试科目、考试安排及备考路径。考试日期、费用和规则以 CSCA 官方公告为准。</p><p>CSCAPilot 是独立学习与备考工具，不是 CSCA 官方报名网站。</p><p><a href="/">返回 CSCAPilot</a> · <a href="/agent">进入学习 Agent</a></p></main>',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': 'https://www.cscapilot.com/#publisher', name: 'Holalobe', brand: { '@type': 'Brand', name: 'CSCAPilot' } },
        { '@type': 'WebPage', name: 'CSCA 考试介绍与备考指南', url: 'https://www.cscapilot.com/csca-prep', isPartOf: { '@id': 'https://www.cscapilot.com/#website' }, publisher: { '@id': 'https://www.cscapilot.com/#publisher' } },
        { '@type': 'FAQPage', mainEntity: [
          { '@type': 'Question', name: '什么是 CSCA？', acceptedAnswer: { '@type': 'Answer', text: 'CSCA 是面向来华本科国际学生的学业水平测试。' } },
          { '@type': 'Question', name: 'CSCA 考哪些科目？', acceptedAnswer: { '@type': 'Answer', text: '常见科目包括中文、数学、物理和化学，具体要求需向目标学校确认。' } },
          { '@type': 'Question', name: 'CSCA 可以用英文考试吗？', acceptedAnswer: { '@type': 'Answer', text: '数学、物理和化学通常可选择中文或英文，请以当次官方考试说明为准。' } }
        ] }
      ]
    }
  }
];

function replaceTag(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Unable to prerender ${label}`);
  return html.replace(pattern, replacement);
}

for (const route of routes) {
  const canonical = `https://www.cscapilot.com${route.pathname}`;
  let html = source;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${route.title}</title>`, 'title');
  html = replaceTag(html, /<meta name="description" content="[^"]*" \/>/i, `<meta name="description" content="${route.description}" />`, 'description');
  html = replaceTag(html, /<meta property="og:title" content="[^"]*" \/>/i, `<meta property="og:title" content="${route.title}" />`, 'og:title');
  html = replaceTag(html, /<meta property="og:description" content="[^"]*" \/>/i, `<meta property="og:description" content="${route.description}" />`, 'og:description');
  html = replaceTag(html, /<meta property="og:url" content="[^"]*" \/>/i, `<meta property="og:url" content="${canonical}" />`, 'og:url');
  html = replaceTag(html, /<meta property="og:image:alt" content="[^"]*" \/>/i, `<meta property="og:image:alt" content="${route.title}" />`, 'og:image:alt');
  html = replaceTag(html, /<meta name="twitter:title" content="[^"]*" \/>/i, `<meta name="twitter:title" content="${route.title}" />`, 'twitter:title');
  html = replaceTag(html, /<meta name="twitter:description" content="[^"]*" \/>/i, `<meta name="twitter:description" content="${route.description}" />`, 'twitter:description');
  html = replaceTag(html, /<link rel="canonical" href="[^"]*" \/>/i, `<link rel="canonical" href="${canonical}" />`, 'canonical');
  html = replaceTag(html, /<script type="application\/ld\+json" id="cscapilot-structured-data">[\s\S]*?<\/script>/i, `<script type="application/ld+json" id="cscapilot-structured-data">${JSON.stringify(route.structuredData)}</script>`, 'structured data');
  html = replaceTag(html, /<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${route.body}</div>`, 'body');

  const outputDir = path.join(distDir, route.pathname.slice(1));
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
}

console.log(`Prerendered ${routes.length + 1} public routes.`);
