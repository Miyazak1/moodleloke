'use strict';
// Render the real component without a browser to protect notation and plain text.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const file = path.resolve(__dirname, '../src/components/MathContent.tsx');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const component = new Module(file, module);
component.filename = file; component.paths = Module._nodeModulePaths(path.dirname(file));
const load = component.require.bind(component);
component.require = name => name.endsWith('.css') ? {} : load(name);
component._compile(compiled, file);
const render = (text, formatPlainMath = true) => renderToStaticMarkup(React.createElement(component.exports.MathContent, { text, formatPlainMath }));
assert(!render('11/12', false).includes('katex'), 'General prose keeps its existing rendering');
for (const plain of ['2026/11/12', '1.5/2', '1/2.5', 'https://example.test/1/2', '每题 10 分']) {
  assert(!render(plain).includes('katex'), 'Do not reinterpret prose/date/URL/decimal: ' + plain);
  assert(render(plain).includes(plain));
}
const question = render('点 O=(0,0,0)，a^2+b^2，面积 cm^2，结果 74529/655552。');
assert(question.includes('math-content-coordinate'));
assert.equal((question.match(/<sup>2<\/sup>/g) || []).length, 3);
assert(question.includes('<mn>74529</mn>') && question.includes('<mn>655552</mn>'));
assert(render('$\\frac{1}{2}$').includes('<mfrac>'), 'Existing delimited LaTeX is preserved');
assert(!render('<script>alert(1)</script>').includes('<script>'), 'Plain content remains escaped');
console.log('QUESTION_MATH_RENDERING_OK: exact fractions, powers, coordinate wrapping; dates, URLs, decimals and existing LaTeX preserved.');
