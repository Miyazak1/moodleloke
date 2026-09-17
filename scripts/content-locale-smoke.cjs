const assert = require('node:assert/strict');

const API_BASE = (process.env.API_BASE || process.env.PUBLIC_API_BASE || 'http://localhost:3000').replace(/\/$/, '');

async function readContent(locale) {
  const response = await fetch(`${API_BASE}/api/v1/content/home?locale=${encodeURIComponent(locale)}`);
  assert.equal(response.status, 200, `content locale ${locale} expected 200, got ${response.status}`);
  const body = await response.json();
  assert.ok(Array.isArray(body.items), `content locale ${locale} must return items array`);
  assert.ok(body.items.length > 0, `content locale ${locale} must return at least one block`);
  return body.items;
}

async function main() {
  const zhItems = await readContent('zh-CN');
  const enItems = await readContent('en');
  const bogusItems = await readContent('bogus');

  assert.ok(zhItems.every((item) => item.locale === 'zh-CN'), 'zh-CN blocks should be native Chinese blocks');
  assert.ok(zhItems.every((item) => item.requestedLocale === 'zh-CN'), 'zh-CN blocks should report requestedLocale zh-CN');
  assert.ok(zhItems.every((item) => item.isFallback === false), 'zh-CN blocks should not be fallback blocks');

  const enHero = enItems.find((item) => item.key === 'home.hero');
  assert.ok(enHero, 'en content should include home.hero through native or fallback content');
  assert.equal(enHero.requestedLocale, 'en', 'en content should preserve requestedLocale en');

  const bogusHero = bogusItems.find((item) => item.key === 'home.hero');
  assert.ok(bogusHero, 'invalid locale should still return fallback home.hero');
  assert.equal(bogusHero.requestedLocale, 'zh-CN', 'invalid locale should normalize to zh-CN');
  assert.equal(bogusHero.isFallback, false, 'invalid locale normalized to zh-CN should not mark fallback');

  console.log('CSCAlite content locale smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
