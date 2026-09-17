#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const fs = require('node:fs');
const path = require('node:path');
const {
  subjectPracticeScenarioBlueprintFeedbackFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-feedback-policy');

function argValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
}

function readJson(value, label) {
  if (!value) throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(value), 'utf8'));
}

function main() {
  const result = subjectPracticeScenarioBlueprintFeedbackFor({
    ideationPack: readJson(argValue('request-pack'), 'Request pack'),
    executionReceipt: readJson(argValue('execution-receipt'), 'Execution receipt')
  });
  if (result.status !== 'structural_feedback_ready') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outPath = argValue('out');
  if (!outPath) {
    process.stdout.write(output);
    return;
  }
  const absolutePath = path.resolve(outPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, output, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ status: 'written', path: absolutePath, bytes: Buffer.byteLength(output) }, null, 2)}\n`);
}

if (require.main === module) main();
