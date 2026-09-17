#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const engineRoot = path.resolve(__dirname, '..');
const targetRoot = path.resolve(engineRoot, '..', 'plugins', 'cscalite-question-engine', 'vendor', 'question-engine');
const entries = [
  'adapters/portable-host.cjs',
  'dist/core',
  'src/portable-index.cjs',
  'src/portable-runtime.cjs',
  'README.md',
  'package.json'
];

fs.mkdirSync(targetRoot, { recursive: true });
for (const entry of entries) {
  const source = path.join(engineRoot, entry);
  const target = path.join(targetRoot, entry);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}
process.stdout.write(`${JSON.stringify({
  status: 'portable_plugin_bundle_built',
  targetRoot,
  entryCount: entries.length,
  backendIncluded: false,
  providerIncluded: false,
  databaseIncluded: false,
  publicationIncluded: false
}, null, 2)}\n`);
