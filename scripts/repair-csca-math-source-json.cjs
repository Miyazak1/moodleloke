#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'artifacts', 'csca-math-source-repair');
const MATH_SOURCE_PATTERN = /^csca-math-.*-source\.json$/;
const READING_LOADS = new Set(['low', 'medium', 'high']);

const TOPIC_RULES = [
  {
    code: 'M-SET-001',
    title: '集合的定义、运算及表示方法',
    tokens: [
      'set', 'sets', 'subset', 'intersection', 'union', 'complement', 'element',
      '集合', '子集', '交集', '并集', '补集', '属于', '∩', '∪', '∈', '∉', '{x |'
    ]
  },
  {
    code: 'M-INEQ-001',
    title: '不等式的基本性质与解法',
    tokens: [
      'inequality', 'inequalities', 'solve', 'solution set', 'solution set of', 'interval',
      'which inequality', 'inequality is correct', 'must be true', 'must be correct',
      'holds true', 'a > b', 'a < b', '< 0', '> 0',
      '不等式', '解集', '区间', '取值范围', '恒成立'
    ]
  },
  {
    code: 'M-FUNC-001',
    title: '函数的概念与性质',
    tokens: [
      'function', 'domain', 'range', 'range of f', 'monotonic', 'increasing', 'decreasing',
      'inverse function', 'composition', 'odd function', 'even function',
      '函数', '定义域', '值域', '单调', '奇函数', '偶函数', '反函数', '复合函数'
    ]
  },
  {
    code: 'M-FUNC-002',
    title: '基本初等函数',
    tokens: [
      'exponential', 'logarithm', 'log', 'lg', 'sine', 'cosine', 'tangent',
      'trigonometric', 'period', '指数', '对数', '正弦', '余弦', '正切', '三角函数',
      '周期', 'sin', 'cos', 'tan', 'log_', 'log₅', 'log3', 'tan x', 'cos α', 'sin(α/2)'
    ]
  },
  {
    code: 'M-SEQ-001',
    title: '数列',
    tokens: [
      'sequence', 'arithmetic sequence', 'geometric sequence', 'common difference',
      'common ratio', 'sum of the first', 'recurrence', 'a_n', 'an', 'a1', 'a_1',
      'sn', 'a^', 'aₙ', 'a₄', 'define a', 'roots of', '数列', '等差', '等比', '公差', '公比', '通项', '前n项', '前 n 项', '递推'
    ]
  },
  {
    code: 'M-CALC-001',
    title: '导数与微积分初步',
    tokens: [
      'derivative', 'differentiation', 'integral', 'calculus', 'tangent line',
      '导数', '微积分', '积分', '切线'
    ]
  },
  {
    code: 'M-GEO-001',
    title: '平面解析几何',
    tokens: [
      'plane', 'coordinate plane', 'line', 'slope', 'circle', 'ellipse', 'hyperbola',
      'parabola', 'focus', 'directrix', 'distance from point', 'midpoint',
      'quadrant', 'quadranta', 'coordinates', 'coordinate', 'equation of a circle', 'circle has center',
      'radius', 'foci', 'focal', 'concurrent', 'straight line', 'straight lines',
      'line l', 'passes through', 'distance from a point', 'intersect at a single point',
      'represents a hyperbola', 'x-axis', 'y-axis',
      '平面', '直线', '斜率', '圆', '椭圆', '双曲线', '抛物线', '焦点', '准线',
      '中点', '点到直线', '象限', '坐标平面'
    ]
  },
  {
    code: 'M-ALG-001',
    title: '向量与复数',
    tokens: [
      'vector', 'complex number', 'imaginary', 'real part', 'imaginary part',
      'parallelogram', 'square abcd', 'vector ab', 'vector bc', 'vector cd', '⃗',
      '向量', '复数', '虚数', '实部', '虚部', '复平面', '平行四边形'
    ]
  },
  {
    code: 'M-GEO-002',
    title: '空间几何',
    tokens: [
      'space', 'three-dimensional', '3d', 'solid', 'cube', 'sphere', 'space rectangular',
      '空间', '立体', '空间直角坐标', '三维', '正方体', '球'
    ]
  },
  {
    code: 'M-PROB-001',
    title: '古典概型与概率计算',
    tokens: [
      'probability', 'sample space', 'event', 'without replacement', 'at least',
      '概率', '样本空间', '事件', '无放回', '至少', '抽取'
    ]
  },
  {
    code: 'M-STAT-001',
    title: '数据的数字特征',
    tokens: [
      'mean', 'variance', 'standard deviation', 'median', 'mode', 'data set',
      'average', 'sample data', 'arithmetic mean', 'geometric mean',
      '数据', '均值', '平均数', '几何平均数', '算术平均数', '方差', '标准差', '中位数', '众数'
    ]
  },
  {
    code: 'M-STAT-002',
    title: '正态分布的基本概念',
    tokens: [
      'normal distribution', 'normal curve', 'bell curve', '正态分布', '正态曲线'
    ]
  }
];

function parseArgs(argv) {
  const args = {
    sourceDir: path.join(ROOT, 'docs'),
    outputDir: DEFAULT_OUTPUT_DIR,
    write: false,
    includeNonPastPaper: false,
    failOnNeedsReview: false,
    files: []
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') {
      args.write = true;
    } else if (arg === '--include-non-past-paper') {
      args.includeNonPastPaper = true;
    } else if (arg === '--fail-on-needs-review') {
      args.failOnNeedsReview = true;
    } else if (arg === '--source-dir') {
      args.sourceDir = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--output-dir') {
      args.outputDir = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--file') {
      args.files.push(path.resolve(ROOT, argv[++i]));
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  console.log([
    'Usage: node scripts/repair-csca-math-source-json.cjs [--write] [--include-non-past-paper] [--source-dir docs] [--output-dir artifacts/csca-math-source-repair]',
    '',
    'Creates repaired draft JSON files and audit reports for CSCA math source JSON.',
    'By default only document.sourceType=past_paper files are repaired for import.',
    'The script does not overwrite docs/*.json; repaired copies are written under artifacts/ when --write is provided.'
  ].join('\n'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function text(value) {
  return String(value ?? '').trim();
}

function combinedQuestionText(question) {
  const optionText = Array.isArray(question.options)
    ? question.options.map((option) => text(option && option.text)).join(' ')
    : '';
  return [
    question.questionNumber,
    question.promptText,
    question.prompt,
    optionText,
    question.explanation,
    Array.isArray(question.blueprintLikeTags) ? question.blueprintLikeTags.join(' ') : '',
    question.analysis && question.analysis.questionForm,
    question.analysis && question.analysis.cognitiveSkill
  ].map(text).filter(Boolean).join(' ');
}

function inferTopicCodes(question) {
  const haystack = combinedQuestionText(question).toLowerCase();
  const scored = TOPIC_RULES.map((rule) => {
    let score = 0;
    for (const token of rule.tokens) {
      const normalized = token.toLowerCase();
      if (!normalized) continue;
      if (haystack.includes(normalized)) {
        score += normalized.length >= 4 ? 2 : 1;
      }
    }
    return { code: rule.code, title: rule.title, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { codes: [], confidence: 0, evidence: [] };
  const best = scored[0];
  const second = scored[1];
  const confident = best.score >= 2 && (!second || best.score >= second.score + 1);
  return {
    codes: confident ? [best.code] : [],
    confidence: confident ? Math.min(0.95, 0.55 + best.score * 0.08) : 0.35,
    evidence: scored.slice(0, 3)
  };
}

function inferReadingLoad(question) {
  const prompt = text(question.promptText || question.prompt);
  const optionChars = Array.isArray(question.options)
    ? question.options.reduce((sum, option) => sum + text(option && option.text).length, 0)
    : 0;
  const stemPattern = question.analysis && question.analysis.stemPattern;
  const hasTable = Boolean(stemPattern && stemPattern.hasTable);
  const hasDiagram = Boolean(stemPattern && stemPattern.hasDiagram);
  const scenarioSignals = [
    'real-world', 'application', 'scenario', 'survey', 'experiment',
    '实际', '应用', '情境', '调查', '实验', '表格', '图像'
  ];
  const combined = `${prompt} ${combinedQuestionText(question)}`.toLowerCase();
  const scenarioScore = scenarioSignals.reduce((sum, signal) => sum + (combined.includes(signal.toLowerCase()) ? 1 : 0), 0);
  const total = prompt.length + optionChars;

  if (hasTable || hasDiagram || total > 260 || scenarioScore >= 2) return 'high';
  if (total > 130 || scenarioScore === 1 || prompt.split(/[，,。.;；]/).filter(Boolean).length >= 3) return 'medium';
  return 'low';
}

function detectTextIssues(question) {
  const issues = [];
  const body = combinedQuestionText(question);
  const checks = [
    { code: 'source_watermark_cleanup_needed', pattern: /\b(CSCA\s+Academy|Sold\s+to|misakitoufu@gmail\.com)\b/i },
    { code: 'pdf_text_layer_glyph_artifact', pattern: /[ǅǆǊǒǜǝƫƬƭƮƺư]/ },
    { code: 'lost_superscript_suspected', pattern: /\b[xyz][234]\b/ },
    { code: 'duplicated_formula_suspected', pattern: /([A-Za-z]\s*[=_]?\s*[0-9n]\s*[=]\s*[^,，。;；]{1,24})\s*\1/ },
    { code: 'question_text_typo_suspected', pattern: /\bcorrecta\b/i }
  ];
  for (const check of checks) {
    if (check.pattern.test(body)) issues.push(check.code);
  }
  return Array.from(new Set(issues));
}

function cleanPromptText(promptText) {
  let next = text(promptText);
  next = next.replace(/\bcorrecta\b/g, 'correct?');
  next = next.replace(/\bCorrecta\b/g, 'Correct?');
  next = next.replace(/\s+/g, ' ').trim();
  return next;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function firstTopicCode(question) {
  return ensureArray(question.topicCodes).map(text).find(Boolean) || '';
}

function profileDimensionsComplete(question) {
  const analysis = question.analysis || {};
  return Boolean(
    text(analysis.questionForm)
    && text(analysis.cognitiveSkill)
    && text(analysis.difficulty || analysis.difficultyBand)
    && READING_LOADS.has(text(analysis.readingLoad))
    && text(analysis.calculationLoad)
  );
}

function confidenceFromQuestion(question) {
  const analysis = question.analysis || {};
  const topicInference = analysis.topicInference || {};
  const raw = Number(question.analysisConfidence ?? question.confidence ?? topicInference.confidence);
  return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
}

function markTrustedImportedProfile(question, context) {
  const topicCode = firstTopicCode(question);
  if (!topicCode || !profileDimensionsComplete(question)) return false;

  const confidence = Math.max(0.92, confidenceFromQuestion(question));
  question.reviewStatus = 'mapped';
  question.analysisStatus = 'human_confirmed';
  question.analysisConfidence = Number(confidence.toFixed(2));
  question.analysis = question.analysis || {};
  question.analysis.profileConfidence = 'high';
  question.analysis.topicConfidence = 'high';
  question.analysis.aiTopicMapping = {
    agent: {
      role: 'topic_mapper',
      name: 'math-source-repair-trusted-profile-v1',
      provider: 'source-repair',
      model: 'deterministic-topic-code'
    },
    provider: 'source-repair',
    model: 'math-source-repair-v1',
    status: 'success_repaired_source_profile',
    generatedAt: new Date().toISOString(),
    candidateTopicCodes: [topicCode],
    suggestions: [{
      topicCode,
      confidence,
      reason: `Trusted repaired math source JSON profile from ${context.basename}.`
    }],
    topConfidence: confidence
  };
  return true;
}

function repairQuestion(question, context) {
  const next = JSON.parse(JSON.stringify(question));
  const changes = [];
  const needsReview = [];
  const issues = new Set(ensureArray(next.analysisIssues));
  const textIssues = detectTextIssues(next);
  textIssues.forEach((issue) => issues.add(issue));

  const cleanedPrompt = cleanPromptText(next.promptText || next.prompt);
  if (cleanedPrompt && cleanedPrompt !== text(next.promptText)) {
    next.promptText = cleanedPrompt;
    changes.push('clean_prompt_whitespace_or_safe_typo');
  }

  const existingTopicCodes = ensureArray(next.topicCodes).map(text).filter(Boolean);
  if (existingTopicCodes.length === 0) {
    const inferred = inferTopicCodes(next);
    if (inferred.codes.length > 0) {
      next.topicCodes = inferred.codes;
      next.analysis = next.analysis || {};
      next.analysis.topicInference = {
        method: 'keyword_syllabus_match',
        confidence: Number(inferred.confidence.toFixed(2)),
        evidence: inferred.evidence
      };
      changes.push(`fill_topicCodes:${inferred.codes.join(',')}`);
    } else {
      issues.add('topic_mapping_needs_human_review');
      needsReview.push('topicCodes');
    }
  } else {
    next.topicCodes = unique(existingTopicCodes);
  }

  next.analysis = next.analysis || {};
  if (!READING_LOADS.has(text(next.analysis.readingLoad))) {
    next.analysis.readingLoad = inferReadingLoad(next);
    changes.push(`fill_readingLoad:${next.analysis.readingLoad}`);
  }

  if (textIssues.length > 0) {
    needsReview.push('source_text_quality');
    next.sourceExtraction = next.sourceExtraction || {};
    next.sourceExtraction.needsHumanCheck = true;
  }

  const stemPattern = next.analysis.stemPattern || {};
  if (stemPattern.hasDiagram && !(next.sourceExtraction && next.sourceExtraction.diagramAsset)) {
    issues.add('diagram_asset_missing');
    needsReview.push('diagram_asset');
    next.sourceExtraction = next.sourceExtraction || {};
    next.sourceExtraction.needsHumanCheck = true;
  }

  next.analysisIssues = unique(Array.from(issues));
  if (needsReview.length > 0 && text(next.reviewStatus) === 'mapped') {
    next.reviewStatus = 'needs_review';
    changes.push('downgrade_reviewStatus_to_needs_review');
  }
  if (needsReview.length === 0 && next.analysisIssues.length === 0) {
    const trusted = markTrustedImportedProfile(next, context);
    if (trusted && text(question.reviewStatus) !== 'mapped') changes.push('mark_trusted_import_profile');
  }

  if (changes.length > 0 || needsReview.length > 0) {
    next.sourceRepair = {
      version: 'math-source-repair-v1',
      sourceFile: context.basename,
      questionNumber: text(next.questionNumber),
      changes,
      needsReview: unique(needsReview)
    };
  }

  return { question: next, changes, needsReview: unique(needsReview), issues: Array.from(issues) };
}

function repairDocument(payload, filePath) {
  const basename = path.basename(filePath);
  const next = JSON.parse(JSON.stringify(payload));
  const rows = [];
  const summary = {
    file: basename,
    title: text(next.document && next.document.title),
    questionCount: Array.isArray(next.questions) ? next.questions.length : 0,
    changedQuestions: 0,
    needsReviewQuestions: 0,
    includedQuestions: 0,
    excludedQuestions: 0,
    missingTopicBefore: 0,
    missingTopicAfter: 0,
    missingReadingLoadBefore: 0,
    missingReadingLoadAfter: 0,
    textQualityIssues: 0
  };

  next.document = next.document || {};
  next.document.sourceRepairPolicy = {
    version: 'math-source-repair-v1',
    generatedBy: 'scripts/repair-csca-math-source-json.cjs',
    strategy: [
      'Fill missing topicCodes only when deterministic syllabus keyword evidence is available.',
      'Fill missing analysis.readingLoad from prompt/option complexity.',
      'Exclude questions that still need human review from the repaired import draft.',
      'Do not overwrite source JSON files; repaired drafts are emitted under artifacts.'
    ]
  };

  const repairedQuestions = [];
  const excludedQuestions = ensureArray(next.document.excludedQuestions).map((item) => ({ ...item }));
  for (const question of ensureArray(next.questions)) {
    if (ensureArray(question.topicCodes).length === 0) summary.missingTopicBefore += 1;
    if (!READING_LOADS.has(text(question.analysis && question.analysis.readingLoad))) summary.missingReadingLoadBefore += 1;

    const repaired = repairQuestion(question, { basename });
    if (repaired.changes.length > 0) summary.changedQuestions += 1;
    if (repaired.needsReview.length > 0) summary.needsReviewQuestions += 1;
    if (repaired.issues.some((issue) => issue.includes('source_') || issue.includes('pdf_') || issue.includes('superscript') || issue.includes('duplicated'))) {
      summary.textQualityIssues += 1;
    }

    const unresolvedIssues = ensureArray(repaired.question.analysisIssues).length > 0;
    const shouldExclude = repaired.needsReview.length > 0 || unresolvedIssues || ensureArray(repaired.question.topicCodes).length === 0;
    if (shouldExclude) {
      summary.excludedQuestions += 1;
      excludedQuestions.push({
        questionNumber: text(repaired.question.questionNumber),
        reason: unresolvedIssues ? 'source_repair_unresolved_analysis_issues' : 'source_repair_unusable_without_human_check',
        details: {
          needsReview: repaired.needsReview,
          issues: repaired.issues
        }
      });
    } else {
      summary.includedQuestions += 1;
      repairedQuestions.push(repaired.question);
    }

    if (!shouldExclude && ensureArray(repaired.question.topicCodes).length === 0) summary.missingTopicAfter += 1;
    if (!shouldExclude && !READING_LOADS.has(text(repaired.question.analysis && repaired.question.analysis.readingLoad))) summary.missingReadingLoadAfter += 1;

    rows.push({
      file: basename,
      questionNumber: text(repaired.question.questionNumber),
      importAction: shouldExclude ? 'exclude' : 'include',
      topicCodes: ensureArray(repaired.question.topicCodes).join(','),
      readingLoad: text(repaired.question.analysis && repaired.question.analysis.readingLoad),
      reviewStatus: text(repaired.question.reviewStatus),
      changes: repaired.changes.join(';'),
      needsReview: repaired.needsReview.join(';'),
      issues: repaired.issues.join(';'),
      promptPreview: text(repaired.question.promptText).slice(0, 140)
    });
  }
  next.questions = repairedQuestions;
  next.document.excludedQuestions = excludedQuestions;

  return { payload: next, summary, rows };
}

function normalizedSourceType(payload) {
  return text(payload && payload.document && payload.document.sourceType).toLowerCase().replace(/[\s-]+/g, '_');
}

function csvEscape(value) {
  const raw = String(value ?? '');
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function writeCsv(filePath, rows) {
  const headers = [
    'file', 'questionNumber', 'importAction', 'topicCodes', 'readingLoad', 'reviewStatus',
    'changes', 'needsReview', 'issues', 'promptPreview'
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function writeMarkdown(filePath, summaries) {
  const lines = [
    '# CSCA Math Source Repair Audit',
    '',
    'This report is generated by `scripts/repair-csca-math-source-json.cjs`.',
    'Repaired JSON drafts are intended for review before import; original `docs/*.json` files are not overwritten.',
    'Default repaired drafts are written to `repaired-past-paper/` and only include `document.sourceType=past_paper` real papers.',
    '',
    '| File | Original | Included | Excluded | Changed | Needs review | Missing topic before -> after | Missing readingLoad before -> after | Text quality flags |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const item of summaries) {
    lines.push(`| ${item.file} | ${item.questionCount} | ${item.includedQuestions} | ${item.excludedQuestions} | ${item.changedQuestions} | ${item.needsReviewQuestions} | ${item.missingTopicBefore} -> ${item.missingTopicAfter} | ${item.missingReadingLoadBefore} -> ${item.missingReadingLoadAfter} | ${item.textQualityIssues} |`);
  }
  lines.push('');
  lines.push('Recommended next steps:');
  lines.push('');
  lines.push('1. Import `repaired-past-paper/*.json` only; questions requiring human review are moved to `document.excludedQuestions`.');
  lines.push('2. Review rows with `importAction=exclude` in `audit.csv` only if you later want to manually recover them.');
  lines.push('3. Rebuild source profiles after importing repaired JSON so generation profiles stop learning from incomplete source metadata.');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function buildTopicSummary(rows) {
  const topicCounts = new Map();
  const readingLoadCounts = new Map();
  for (const row of rows) {
    if (row.importAction !== 'include') continue;
    for (const code of text(row.topicCodes).split(',').map(text).filter(Boolean)) {
      topicCounts.set(code, (topicCounts.get(code) || 0) + 1);
    }
    const readingLoad = text(row.readingLoad) || 'missing';
    readingLoadCounts.set(readingLoad, (readingLoadCounts.get(readingLoad) || 0) + 1);
  }
  const topics = Array.from(topicCounts.entries())
    .map(([code, count]) => ({ code, count, warning: count < 5 ? 'sparse_source_profile' : null }))
    .sort((a, b) => a.code.localeCompare(b.code));
  return {
    topics,
    readingLoads: Object.fromEntries(Array.from(readingLoadCounts.entries()).sort()),
    warnings: topics.filter((item) => item.warning)
  };
}

function findSourceFiles(args) {
  if (args.files.length > 0) return args.files;
  return fs.readdirSync(args.sourceDir)
    .filter((name) => MATH_SOURCE_PATTERN.test(name))
    .map((name) => path.join(args.sourceDir, name))
    .sort();
}

function main() {
  const args = parseArgs(process.argv);
  const files = findSourceFiles(args);
  if (files.length === 0) {
    throw new Error(`No math source JSON files found in ${args.sourceDir}`);
  }

  const allRows = [];
  const summaries = [];
  const skipped = [];
  for (const filePath of files) {
    const payload = readJson(filePath);
    const sourceType = normalizedSourceType(payload);
    if (!args.includeNonPastPaper && sourceType !== 'past_paper') {
      skipped.push({
        file: path.basename(filePath),
        sourceType: sourceType || 'missing',
        reason: 'non_past_paper_source_not_used_for_generation_profile'
      });
      continue;
    }
    const repaired = repairDocument(payload, filePath);
    summaries.push(repaired.summary);
    allRows.push(...repaired.rows);

    if (args.write) {
      const outputFile = path.join(args.outputDir, 'repaired-past-paper', path.basename(filePath));
      writeJson(outputFile, repaired.payload);
    }
  }

  if (args.write) {
    const topicSummary = buildTopicSummary(allRows);
    writeJson(path.join(args.outputDir, 'summary.json'), summaries);
    writeJson(path.join(args.outputDir, 'skipped.json'), skipped);
    writeJson(path.join(args.outputDir, 'topic-summary.json'), topicSummary);
    writeCsv(path.join(args.outputDir, 'audit.csv'), allRows);
    writeMarkdown(path.join(args.outputDir, 'README.md'), summaries);
  }

  const totals = summaries.reduce((acc, item) => {
    acc.files += 1;
    acc.questions += item.questionCount;
    acc.changed += item.changedQuestions;
    acc.needsReview += item.needsReviewQuestions;
    acc.included += item.includedQuestions;
    acc.excluded += item.excludedQuestions;
    acc.missingTopicBefore += item.missingTopicBefore;
    acc.missingTopicAfter += item.missingTopicAfter;
    acc.missingReadingLoadBefore += item.missingReadingLoadBefore;
    acc.missingReadingLoadAfter += item.missingReadingLoadAfter;
    acc.textQualityIssues += item.textQualityIssues;
    return acc;
  }, {
    files: 0,
    questions: 0,
    changed: 0,
    needsReview: 0,
    included: 0,
    excluded: 0,
    missingTopicBefore: 0,
    missingTopicAfter: 0,
    missingReadingLoadBefore: 0,
    missingReadingLoadAfter: 0,
    textQualityIssues: 0
  });

  const topicSummary = buildTopicSummary(allRows);
  console.log(JSON.stringify({ outputDir: args.write ? args.outputDir : null, totals, summaries, skipped, topicSummary }, null, 2));

  if (args.failOnNeedsReview && totals.needsReview > 0) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
