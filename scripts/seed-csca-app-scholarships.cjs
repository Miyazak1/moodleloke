const path = require('node:path');
const fs = require('node:fs');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const SOURCE_URL = 'https://csca.app/zh/scholarships';
const VERIFY_DATE = '2026-07-14';
const PAGE_COUNT = 23;
const DATA_PATH = path.resolve(__dirname, 'data', 'csca-app-scholarships.seed.json');

const TYPE_MAP = new Map([
  ['政府奖学金', 'government'],
  ['大学奖学金', 'university'],
  ['省级奖学金', 'provincial'],
  ['孔子学院奖学金', 'confucius'],
  ['其他奖学金', 'other']
]);

const BENEFIT_LABELS = {
  tuition: '学费',
  accommodation: '住宿费',
  living_allowance: '生活费',
  insurance: '医疗保险',
  airfare: '国际旅费',
  settlement: '一次性安置费'
};

function getChromium() {
  try {
    return require('../frontend/node_modules/playwright').chromium;
  } catch {
    return require('playwright').chromium;
  }
}

function clean(value) {
  return typeof value === 'string' ? value.replace(/\u00a0/g, ' ').trim() : value;
}

function normalizeCountry(country) {
  return country?.label_en || country?.label_zh || country?.id || country;
}

function normalizeProgram(program) {
  return program?.label_zh || program?.label_en || program?.id || program;
}

function parseCard(card) {
  const typeLine = card.lines.find((line) => TYPE_MAP.has(line));
  const degreeLine = card.lines.find((line) => /\b(?:bachelor|master|doctoral|language)\b/.test(line));
  const ageLine = card.lines.find((line) => /^≤|^\d+[-–]\d+\s*岁|岁$/.test(line));
  const deadlineLine = card.lines.find((line) => /\d+月\d+日|截止|长期开放/.test(line));
  const summary = card.lines.find((line, index) => index > 0 && line.length > 28 && !TYPE_MAP.has(line)) || '';
  const provider = card.lines.find((line, index) => index > 0 && index < 3 && line.length <= 40 && !TYPE_MAP.has(line) && line !== '全额资助' && line !== degreeLine && line !== ageLine && line !== deadlineLine && line !== summary);
  const countryLine = card.lines.find((line) => /Countries|Myanmar|Thailand|Vietnam|Pakistan|Nepal|ASEAN|SCO/.test(line));
  return { typeLine, degreeLine, ageLine, deadlineLine, summary, provider, countryLine };
}

function toSeedItem(card, object, index) {
  const parsed = parseCard(card);
  const type = object?.type || TYPE_MAP.get(parsed.typeLine) || 'other';
  const fundingLevel = object?.isFullScholarship || card.lines.includes('全额资助') ? 'full' : object?.funding ? 'partial' : 'unknown';
  const funding = object?.funding || {};
  const benefitItems = Object.entries(BENEFIT_LABELS)
    .map(([key, label]) => funding[key] === undefined ? null : ({ key, label, included: Boolean(funding[key]) }))
    .filter(Boolean);
  const benefits = benefitItems.filter((item) => item.included).map((item) => item.label);
  const content = clean(object?.content) || parsed.summary || card.lines.join('\n');
  const contact = object?.contact || undefined;
  const website = contact?.website || card.href;
  return {
    slug: card.slug,
    title: clean(object?.title) || card.lines[0],
    type,
    fundingLevel,
    providerName: clean(object?.university) || parsed.provider || undefined,
    providerLocation: clean(object?.city) || undefined,
    summary: clean(object?.summary) || parsed.summary || content.slice(0, 240),
    coverage: benefits.length ? benefits.join('、') : (fundingLevel === 'full' ? '全额资助' : undefined),
    applicableDegree: Array.isArray(object?.degreeLevels) && object.degreeLevels.length ? object.degreeLevels.join(', ') : parsed.degreeLine,
    applicableProgram: Array.isArray(object?.specialPrograms) ? object.specialPrograms.map(normalizeProgram).filter(Boolean).join('、') || undefined : undefined,
    amountText: benefits.length ? `资助内容：${benefits.join('、')}。` : undefined,
    requirementText: content,
    bodySections: [{ title: '奖学金详情', body: content }],
    benefitItems,
    eligibilityItems: [object?.ageLimit?.min || object?.ageLimit?.max ? { label: '年龄限制', value: [object.ageLimit.min ? `≥${object.ageLimit.min} 岁` : '', object.ageLimit.max ? `≤${object.ageLimit.max} 岁` : ''].filter(Boolean).join('，') } : parsed.ageLine ? { label: '年龄限制', value: parsed.ageLine } : null].filter(Boolean),
    applicationMaterials: [],
    applicationSteps: [],
    contactInfo: contact ? { label: '联系方式', email: contact.email, phone: contact.phone, website: contact.website } : undefined,
    actionLinks: [{ label: '查看 CSCA Academy 来源页', url: card.href, kind: 'source' }, website && website !== card.href ? { label: '访问申请/官网', url: website, kind: 'primary' } : null].filter(Boolean),
    deadlineLabel: clean(object?.deadline) || parsed.deadlineLine,
    targetCountries: Array.isArray(object?.targetCountries) ? object.targetCountries.map(normalizeCountry).filter(Boolean) : parsed.countryLine ? [parsed.countryLine] : [],
    targetRegions: [],
    benefits,
    sourceUrl: card.href,
    sourceLabel: 'CSCA Academy 奖学金页面（浏览器采集）',
    lastVerifiedAt: VERIFY_DATE,
    sortOrder: index + 1,
    status: 'published',
    scrapeMeta: { page: card.page, href: card.href, hasStructuredDetail: Boolean(object), capturedFrom: object ? 'rsc-or-detail' : 'list-card' }
  };
}

function dateOrNull(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function toStatus(value) {
  return value === 'archived' ? SchoolStatus.archived : value === 'draft' ? SchoolStatus.draft : SchoolStatus.published;
}

function toData(item) {
  return withoutUndefined({
    title: item.title,
    type: item.type || 'other',
    fundingLevel: item.fundingLevel || 'unknown',
    providerName: item.providerName,
    providerLocation: item.providerLocation,
    summary: item.summary,
    coverage: item.coverage,
    applicableDegree: item.applicableDegree,
    applicableProgram: item.applicableProgram,
    amountText: item.amountText,
    requirementText: item.requirementText,
    bodySections: item.bodySections || [],
    benefitItems: item.benefitItems || [],
    eligibilityItems: item.eligibilityItems || [],
    applicationMaterials: item.applicationMaterials || [],
    applicationSteps: item.applicationSteps || [],
    contactInfo: item.contactInfo,
    actionLinks: item.actionLinks || [],
    deadlineDate: dateOrNull(item.deadlineDate),
    deadlineLabel: item.deadlineLabel,
    targetCountries: item.targetCountries || [],
    targetRegions: item.targetRegions || [],
    benefits: item.benefits || [],
    sourceUrl: item.sourceUrl,
    sourceLabel: item.sourceLabel,
    lastVerifiedAt: dateOrNull(item.lastVerifiedAt),
    sortOrder: item.sortOrder || 0,
    status: toStatus(item.status)
  });
}

function readSeedItems() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  throw new Error(`Seed file ${DATA_PATH} does not contain an items array.`);
}

function writeSeedFile(scraped) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  const payload = {
    source: SOURCE_URL,
    capturedAt: new Date().toISOString(),
    lastVerifiedAt: VERIFY_DATE,
    count: scraped.items.length,
    visibleReports: scraped.visibleReports,
    listObjects: scraped.listObjects,
    detailReport: scraped.detailReport,
    items: scraped.items
  };
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function waitForScholarshipPage(page) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button'));
    for (const button of candidates) {
      const text = (button.textContent || '').replace(/\s+/g, '');
      if (['接受全部', '拒绝全部', '×', '关闭'].includes(text)) {
        button.click();
      }
    }
  }).catch(() => undefined);
}

async function clickNextScholarshipPage(page, pageNo) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const buttonTexts = buttons.map((button) => ({
      text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
      disabled: button.disabled,
      aria: button.getAttribute('aria-label')
    }));
    const next = buttons.find((button) => {
      const text = (button.textContent || '').replace(/\s+/g, '');
      const aria = (button.getAttribute('aria-label') || '').replace(/\s+/g, '');
      return !button.disabled && (text.includes('下一页') || text.toLowerCase().includes('next') || aria.includes('下一页') || aria.toLowerCase().includes('next'));
    });
    if (!next) return { clicked: false, buttonTexts };
    next.click();
    return { clicked: true, buttonTexts };
  });
  if (!state.clicked) {
    throw new Error(`Could not find enabled 下一页 button on scholarship page ${pageNo}. Buttons: ${JSON.stringify(state.buttonTexts.slice(-20))}`);
  }
  await page.waitForTimeout(1800);
}

async function scrapeVisibleCards(page) {
  await page.goto(SOURCE_URL, { waitUntil: 'load', timeout: 30000 });
  await waitForScholarshipPage(page);
  const all = [];
  const reports = [];
  for (let pageNo = 1; pageNo <= PAGE_COUNT; pageNo += 1) {
    const data = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/zh/scholarships/"]')).filter((anchor) => {
        const href = anchor.getAttribute('href') || '';
        return !href.includes('/countries') && !href.includes('/types') && !href.includes('/field/') && !href.endsWith('/scholarships/government') && !href.endsWith('/scholarships/full-funding') && !href.endsWith('/scholarships/belt-and-road');
      });
      const seen = new Set();
      const cards = [];
      for (const anchor of links) {
        const href = anchor.href;
        const slug = href.split('/').filter(Boolean).pop();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        let el = anchor;
        for (let i = 0; i < 6 && el.parentElement; i += 1) {
          el = el.parentElement;
          const text = el.innerText || '';
          if (text.includes('获取模拟试卷') && text.length > 80) break;
        }
        const text = (el.innerText || anchor.textContent || '').trim();
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        cards.push({ slug, href, text, lines });
      }
      const range = (document.body.innerText.match(/显示\s*\d+-\d+\s*\/\s*共\s*\d+\s*条/) || [])[0];
      return { range, cards };
    });
    reports.push({ page: pageNo, range: data.range, count: data.cards.length });
    data.cards.forEach((card) => all.push({ ...card, page: pageNo }));
    if (pageNo < PAGE_COUNT) {
      await clickNextScholarshipPage(page, pageNo);
    }
  }
  return { cards: Array.from(new Map(all.map((card) => [card.slug, card])).values()), reports };
}

async function extractObjectsFromPage(page) {
  return page.evaluate(() => {
    function byteTake(str, start, byteLen) {
      let bytes = 0;
      let i = start;
      for (; i < str.length && bytes < byteLen; i += 1) {
        const code = str.charCodeAt(i);
        let cp = code;
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
          const next = str.charCodeAt(i + 1);
          if (next >= 0xdc00 && next <= 0xdfff) {
            cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
            i += 1;
          }
        }
        bytes += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
      }
      return { text: str.slice(start, i), end: i };
    }
    const chunks = [];
    for (const script of Array.from(document.scripts)) {
      const text = script.textContent || '';
      if (!text.startsWith('self.__next_f.push(')) continue;
      const inside = text.slice('self.__next_f.push('.length, -1);
      try { chunks.push(JSON.parse(inside)[1] || ''); } catch {}
    }
    const raw = chunks.join('');
    const objectSource = raw.replace(/\\"/g, '"');
    const textSource = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    const textMap = {};
    const re = /([0-9a-f]+):T([0-9a-f]+),/g;
    let match;
    while ((match = re.exec(textSource))) {
      const got = byteTake(textSource, match.index + match[0].length, Number.parseInt(match[2], 16));
      textMap[match[1]] = got.text;
      re.lastIndex = got.end;
    }
    const objects = [];
    const marker = '{"id":"details';
    let pos = 0;
    while ((pos = objectSource.indexOf(marker, pos)) !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;
      for (let i = pos; i < objectSource.length; i += 1) {
        const ch = objectSource[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
          if (ch === '{') depth += 1;
          else if (ch === '}') {
            depth -= 1;
            if (depth === 0) { end = i + 1; break; }
          }
        }
      }
      if (end > pos) {
        try {
          const obj = JSON.parse(objectSource.slice(pos, end));
          if (typeof obj.content === 'string' && obj.content[0] === '$') obj.content = textMap[obj.content.slice(1)] || obj.content;
          objects.push(obj);
        } catch {}
        pos = end;
      } else {
        pos += marker.length;
      }
    }
    return objects;
  });
}

async function scrapeStructuredObjects(page, cards) {
  await page.goto(SOURCE_URL, { waitUntil: 'load', timeout: 30000 });
  await waitForScholarshipPage(page);
  const listObjects = await extractObjectsFromPage(page);
  const objectMap = new Map(listObjects.map((object) => [object.slug, object]));
  const missing = cards.filter((card) => !objectMap.has(card.slug));
  const detailReport = [];
  for (const card of missing) {
    await page.goto(`${SOURCE_URL}/${card.slug}`, { waitUntil: 'load', timeout: 30000 });
    await waitForScholarshipPage(page);
    const detailObjects = await extractObjectsFromPage(page);
    const match = detailObjects.find((object) => object.slug === card.slug) || detailObjects.find((object) => object.title === card.lines[0]);
    if (match) objectMap.set(card.slug, match);
    detailReport.push({ slug: card.slug, objects: detailObjects.length, matched: Boolean(match) });
  }
  return { objectMap, listObjects: listObjects.length, detailReport };
}

async function scrapeScholarships({ screenshots = false } = {}) {
  const chromium = getChromium();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'zh-CN',
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  });
  try {
    const visible = await scrapeVisibleCards(page);
    if (visible.cards.length !== 275) throw new Error(`Expected 275 scholarships, got ${visible.cards.length}.`);
    const structured = await scrapeStructuredObjects(page, visible.cards);
    const items = visible.cards.map((card, index) => toSeedItem(card, structured.objectMap.get(card.slug), index));
    if (screenshots) {
      const dir = path.resolve(__dirname, '..', 'artifacts', 'scholarships');
      require('node:fs').mkdirSync(dir, { recursive: true });
      await page.goto(SOURCE_URL, { waitUntil: 'load', timeout: 30000 });
      await waitForScholarshipPage(page);
      await page.screenshot({ path: path.join(dir, 'csca-scholarships-list.png'), fullPage: false });
      await page.goto(`${SOURCE_URL}/${items[0].slug}`, { waitUntil: 'load', timeout: 30000 });
      await waitForScholarshipPage(page);
      await page.screenshot({ path: path.join(dir, 'csca-scholarships-detail.png'), fullPage: false });
    }
    return { items, visibleReports: visible.reports, listObjects: structured.listObjects, detailReport: structured.detailReport };
  } finally {
    await browser.close();
  }
}

async function upsertScholarships(items, { replace = false } = {}) {
  const prisma = new PrismaClient();
  try {
    const result = { upserted: 0, items: [] };
    if (replace) {
      const archived = await prisma.scholarship.updateMany({
        where: { status: SchoolStatus.published },
        data: { status: SchoolStatus.archived }
      });
      result.archivedBeforeUpsert = archived.count;
    }
    for (const item of items) {
      const data = toData(item);
      const saved = await prisma.scholarship.upsert({
        where: { slug: item.slug },
        update: data,
        create: { slug: item.slug, ...data },
        select: { id: true, slug: true, title: true, status: true }
      });
      result.upserted += 1;
      result.items.push(saved);
    }
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const screenshots = process.argv.includes('--screenshots');
  const replace = process.argv.includes('--replace');
  const refresh = process.argv.includes('--refresh') || process.argv.includes('--scrape');
  const scraped = refresh ? await scrapeScholarships({ screenshots }) : { items: readSeedItems() };
  const seedFile = refresh ? writeSeedFile(scraped) : null;
  const summary = {
    scraped: scraped.items.length,
    structured: scraped.items.filter((item) => item.scrapeMeta.hasStructuredDetail).length,
    listOnly: scraped.items.filter((item) => !item.scrapeMeta.hasStructuredDetail).length,
    first: scraped.items[0]?.slug,
    last: scraped.items.at(-1)?.slug,
    seedFile: DATA_PATH,
    refreshed: refresh,
    seedFileCount: seedFile?.count
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, summary }, null, 2));
    return;
  }
  const result = await upsertScholarships(scraped.items, { replace });
  console.log(JSON.stringify({ summary, result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
