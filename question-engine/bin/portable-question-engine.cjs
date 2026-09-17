#!/usr/bin/env node
'use strict';

const portable = require('../src/portable-index.cjs');

const raw = process.argv[2];
if (!raw) throw new Error('usage: portable-question-engine <json-input>');
const input = JSON.parse(raw);
process.stdout.write(`${JSON.stringify(portable.generatePreview(input), null, 2)}\n`);
