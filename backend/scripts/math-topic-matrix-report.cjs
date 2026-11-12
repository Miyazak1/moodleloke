'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../../artifacts/math-topic-matrix');
const legacy = ['math-plane-geometry', 'math-solid-vector', 'math-complex', 'math-solid-geometry', 'math-coordinate-geometry',
  'math-function-basic', 'math-sequence', 'math-function', 'math-calculus', 'math-probability', 'math-inequality', 'math-set'];
const canonical = ['M-ALG-001', 'M-CALC-001', 'M-FUNC-001', 'M-FUNC-002', 'M-GEO-001', 'M-GEO-002',
  'M-INEQ-001', 'M-PROB-001', 'M-SEQ-001', 'M-SET-001', 'M-STAT-001', 'M-STAT-002'];
const rows = new Map();
for (const file of fs.readdirSync(directory).filter(name => /^run-\d+\.json$/.test(name)).sort()) {
  const report = JSON.parse(fs.readFileSync(path.join(directory, file)));
  for (const row of report.results) {
    if (report.count !== 3 || !['pass', 'bank_only_pass'].includes(row.state)) continue;
    assert.equal(row.distinctQuestions, 6);
    assert.equal(row.rounds.length, 2);
    assert.equal(row.state === 'bank_only_pass', row.code === 'math-coordinate-geometry');
    rows.set(row.code + ':' + row.difficulty, { ...row, sourceRun: file });
  }
}
const cases = [], missing = [];
for (const code of [...legacy, ...canonical]) for (const difficulty of ['basic', 'medium', 'hard']) {
  const row = rows.get(code + ':' + difficulty);
  if (row) cases.push(row); else missing.push({ code, difficulty });
}
const result = { generatedAt: new Date().toISOString(), summary: { expectedCases: 72, passed: cases.length,
  generatedPassed: cases.filter(row => row.state === 'pass').length,
  bankOnlyPassed: cases.filter(row => row.state === 'bank_only_pass').length,
  answeredQuestions: cases.reduce((sum, row) => sum + row.distinctQuestions, 0), providerCalls: 0, costUsd: 0 }, missing, cases };
fs.writeFileSync(path.join(directory, 'acceptance.json'), JSON.stringify(result, null, 2));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const table = [...legacy, ...canonical].map(code => {
  const topic = cases.find(row => row.code === code);
  return `<tr><th>${escape(topic?.title ?? code)}<small>${escape(code)}</small></th>` + ['basic','medium','hard'].map(band => {
    const row = rows.get(code + ':' + band);
    return row ? `<td class="${row.state}"><a href="${escape(row.sourceRun)}">${row.state === 'pass' ? '自动出题通过' : '现有题库通过'}</a><small>作答、结算、续批 · 6题</small></td>` : '<td class="pending">待完成</td>';
  }).join('') + '</tr>';
}).join('');
fs.writeFileSync(path.join(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>数学1.43完整知识点验收</title>
<style>body{font:16px/1.6 system-ui,sans-serif;color:#173044;background:#f6f9fb;margin:0;padding:24px}main{max-width:1100px;margin:auto}h1{font-size:26px}aside{border-left:4px solid #b07800;background:#fff6dc;padding:14px 18px}.table{overflow:auto}table{border-collapse:collapse;width:100%;background:white;margin:24px 0}th,td{padding:14px;text-align:left;border:1px solid #dce5ea}thead{background:#e9f0f7}small{display:block;font-size:12px;font-weight:400;color:#526678}td a{color:inherit}.pass{background:#e9f9f0;color:#16613b}.bank_only_pass{background:#fff6dc;color:#805600}.pending{color:#687786}a{color:#2456bc}</style>
<main><h1>数学1.43完整知识点验收</h1><p>24个线上编码 × 基础／中等／困难：已完成 ${cases.length}/72 项。自动出题 ${result.summary.generatedPassed} 项，题库练习 ${result.summary.bankOnlyPassed} 项；共作答 ${result.summary.answeredQuestions} 道题。Provider 调用 0。</p>
<aside>空间直角坐标系尚无1.43正式出题范围，保留现有题库。表中的“现有题库通过”使用本地验收题库夹具验证链路，不代表已覆盖自动出题或保证线上库存充足。</aside>
<div class="table"><table><thead><tr><th>知识点／编码</th><th>基础</th><th>中等</th><th>困难</th></tr></thead><tbody>${table}</tbody></table></div>
<p>每项均新建3题、检查实际答案、保存并提交结算、继续3道不重复题，再完成新批次；检查中文／英文刷新、出题范围、难度及重复请求幂等。结果来自分段保存的真实 HTTP 验收运行；中断及失败记录保留在原始报告中，只有通过项计入本表。</p>
<p><a href="acceptance.json">完整结果与来源记录</a> · <a href="spatial-bank-notice-390.jpg">手机端范围提示</a> · <a href="continued-complex-hard-1440.jpg">刷新复盘后的同难度续批</a></p></main></html>`);
console.log(JSON.stringify(result.summary));
if (missing.length) { console.log('REMAINING', JSON.stringify(missing)); process.exitCode = 1; }
