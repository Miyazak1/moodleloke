'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = path.resolve(__dirname, '../artifacts/question-layout');
const checks = JSON.parse(fs.readFileSync(path.join(directory, 'layout-metrics.json')));
assert.equal(checks.length, 40);
for (const c of checks) {
  assert.equal(c.pageOverflow, 0); assert.equal(c.navOverflow, 0); assert.equal(c.mathErrors, 0);
  assert(c.timerHeight <= 40); assert(c.optionOverflows.every(n => n <= 1)); assert(c.images.every(i => i.loaded));
}
const cards = checks.map(c => {
  const file = `${c.key}-${c.language}-${c.viewport}.jpg`;
  assert(fs.existsSync(path.join(directory, file)));
  return `<article><h2>${c.key} · ${c.language} · ${c.viewport}px</h2><a href="${file}"><img loading="lazy" src="${file}" alt="${c.key}, ${c.viewport}px"></a></article>`;
});
fs.writeFileSync(path.join(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>题目排版本地验收</title><style>body{margin:0;background:#f4f7fb;color:#203547;font:15px/1.6 system-ui,sans-serif}header,main{max-width:1400px;margin:auto;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{min-width:0;padding:12px;background:white;border:1px solid #dce5ed;border-radius:12px}h2{font-size:14px}img{display:block;max-width:100%;height:auto;margin:auto}a{color:#315dff}</style><header><h1>题目排版本地验收</h1><p>真实学生页面：中英文 × 320 / 390 / 768 / 1024 / 1440，40 组无横向溢出。点击截图查看原尺寸。</p><p>native 为正式数学题；real-historical-external 为真实历史题；synthetic-original 为合成原图测试；piecewise_range 为默认关闭的读图试点。后两类不代表正式题源覆盖。</p><p>复盘：<a href="review-320-en.jpg">320px</a> · <a href="review-1440-en.jpg">1440px</a>。全部为本地专用测试账号，无线上数据。</p></header><main>${cards.join('')}</main></html>`);
console.log('QUESTION_LAYOUT_OK: 40 responsive checks; screenshot gallery created.');
