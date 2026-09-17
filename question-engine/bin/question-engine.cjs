#!/usr/bin/env node
'use strict';

const engine = require('../src/index.cjs');

const command = String(process.argv[2] || 'catalog').trim();
let report;
if (command === 'catalog') report = engine.capabilityCatalog();
else if (command === 'readiness') report = engine.releaseReadiness();
else throw new Error(`unknown_question_engine_command:${command}`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
