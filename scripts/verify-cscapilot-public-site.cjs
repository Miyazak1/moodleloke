const assert = require('node:assert/strict');

const previewTrailingSlash = process.argv.includes('--preview-trailing-slash');
const cliBaseUrl = process.argv.slice(2).find((value) => /^https?:\/\//.test(value));
const rawBaseUrl = process.env.PUBLIC_SITE_BASE_URL || cliBaseUrl || 'https://www.cscapilot.com';
const baseUrl = rawBaseUrl.replace(/\/+$/, '');

async function fetchText(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return { response, text: await response.text() };
}

async function main() {
  const pages = [
    ['/', 'https://www.cscapilot.com/', 'CSCAPilot'],
    ['/csca-prep', 'https://www.cscapilot.com/csca-prep', 'CSCA'],
    ['/about', 'https://www.cscapilot.com/about', 'CSCAPilot']
  ];
  for (const [pathname, canonical, marker] of pages) {
    const requestPath = previewTrailingSlash && pathname !== '/' ? `${pathname}/` : pathname;
    const { response, text } = await fetchText(requestPath);
    assert.equal(response.status, 200, `${pathname} must return 200`);
    assert.match(text, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('.', '\\.')}"`));
    assert.match(text, /og-cscapilot\.png/);
    assert.match(text, /application\/ld\+json/);
    assert.ok(text.includes(marker), `${pathname} must contain ${marker}`);
  }

  const robots = await fetchText('/robots.txt');
  assert.equal(robots.response.status, 200);
  assert.match(robots.text, /Sitemap: https:\/\/www\.cscapilot\.com\/sitemap\.xml/);
  assert.match(robots.text, /Disallow: \/agent/);

  const sitemap = await fetchText('/sitemap.xml');
  assert.equal(sitemap.response.status, 200);
  assert.match(sitemap.text, /https:\/\/www\.cscapilot\.com\/csca-prep/);
  assert.match(sitemap.text, /https:\/\/www\.cscapilot\.com\/about/);

  const image = await fetch(`${baseUrl}/og-cscapilot.png`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') || '', /^image\/png/);
  assert.ok(Number(image.headers.get('content-length') || 0) > 100_000 || (await image.arrayBuffer()).byteLength > 100_000);

  console.log(JSON.stringify({ status: 'ok', baseUrl, previewTrailingSlash, checked: ['/', '/csca-prep', '/about', '/robots.txt', '/sitemap.xml', '/og-cscapilot.png'] }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
