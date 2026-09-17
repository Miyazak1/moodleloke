const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { loadEnv } = require('./load-env.cjs');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const { Prisma, PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');

loadEnv(path.resolve(__dirname, '..'));
process.env.CSCA_ALLOW_SMOKE_SUBJECTS = 'true';

const prisma = new PrismaClient();
const suffix = Date.now();
const subject = `smoke_math_${suffix}`;
const fixtureSubject = `smoke_math_${suffix + 1}`;
const diagnosticSubject = `smoke_math_${suffix + 2}`;
const blockedSubject = `smoke_math_${suffix + 3}`;
const lowConfidenceSubject = `smoke_math_${suffix + 4}`;
const outOfSyllabusSubject = `smoke_math_${suffix + 5}`;
const syllabusVersion = `smoke-series-${suffix}`;
const topicCode = `M-SERIES-SMOKE-${suffix}`;
const importSubject = subject;
const importSyllabusVersion = syllabusVersion;
const importTopicCode = `M-IMPORT-SMOKE-${suffix}`;
const fixtureSyllabusVersion = `${syllabusVersion}-fixture`;
const fixtureTopicCode = `M-FIXTURE-SMOKE-${suffix}`;
const diagnosticSyllabusVersion = `${syllabusVersion}-diagnostic`;
const blockedSyllabusVersion = `${syllabusVersion}-blocked`;
const blockedTopicCode = `M-BLOCKED-SMOKE-${suffix}`;
const lowConfidenceSyllabusVersion = `${syllabusVersion}-low-confidence`;
const lowConfidenceTopicCode = `M-LOWCONF-SMOKE-${suffix}`;
const outOfSyllabusVersion = `${syllabusVersion}-out-of-syllabus`;
const outOfSyllabusTopicCode = `M-OUTSYL-SMOKE-${suffix}`;
const created = {
  topicId: null,
  importTopicId: null,
  fixtureTopicId: null,
  blockedTopicId: null,
  lowConfidenceTopicId: null,
  outOfSyllabusTopicId: null,
  documentIds: [],
  importDocumentIds: [],
  sourceQuestionIds: [],
  styleProfileId: null,
  seriesProfileId: null,
  generationProfileIds: [],
  syllabusImportId: null,
  importSyllabusImportId: null,
  fixtureSyllabusImportId: null,
  blueprintId: null,
  generationJobId: null,
  taskIds: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function distributionSum(distribution) {
  if (!distribution || typeof distribution !== 'object') return 0;
  return Object.values(distribution).reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
}

function assertNormalizedPaperTarget(target, label) {
  assert(target?.schemaVersion === 'csca-normalized-paper-target-v1', `${label} should expose normalized paper target schema.`);
  assert(target?.targetCount === 48, `${label} normalized paper target should target 48 questions, got ${target?.targetCount}.`);
  const distributions = target?.distributions ?? {};
  for (const key of ['difficulty', 'questionForm', 'cognitiveSkill', 'readingLoad', 'calculationLoad', 'answer']) {
    const total = distributionSum(distributions[key]);
    assert(total === 48, `${label} normalized ${key} distribution should sum to 48, got ${total}: ${JSON.stringify(distributions[key] ?? null)}.`);
    for (const [entryKey, value] of Object.entries(distributions[key] ?? {})) {
      assert(Number.isInteger(value) && value > 0, `${label} normalized ${key}.${entryKey} should be a positive integer, got ${value}.`);
    }
  }
}

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called in continuous generation profile smoke.');
    }
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function loadSourceJsonFixture(relativePath) {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function sourceAnalysis(index) {
  const difficulty = index % 3 === 0 ? 'hard' : index % 2 === 0 ? 'medium' : 'basic';
  const cognitiveSkill = index % 2 === 0 ? 'standard_application' : 'concept_judgement';
  return {
    schemaVersion: 'source-question-profile-v2',
    difficulty,
    questionForm: index % 2 === 0 ? 'calculation_application' : 'concept_judgement',
    cognitiveSkill,
    readingLoad: index % 2 === 0 ? 'low' : 'medium',
    calculationLoad: index % 3 === 0 ? 'medium' : 'light',
    estimatedTimeSeconds: 70 + index * 5,
    optionPattern: {
      optionStyle: 'numeric',
      distractorTypes: ['calculation_slip'],
      commonMisconceptions: ['sign_error']
    }
  };
}

async function cleanup() {
  if (created.generationJobId) {
    await prisma.$executeRaw`DELETE FROM "csca_ai_generation_jobs" WHERE "id" = ${created.generationJobId}`.catch(() => undefined);
  }
  await prisma.$executeRaw`
    DELETE FROM "csca_ai_questioning_tasks"
    WHERE "subject" IN (${subject}, ${fixtureSubject}, ${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  if (created.taskIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_ai_questioning_tasks"
      WHERE "id"::text IN (${Prisma.join(created.taskIds)})
    `.catch(() => undefined);
  }
  if (created.blueprintId) {
    await prisma.$executeRaw`DELETE FROM "csca_question_blueprints" WHERE "id" = ${created.blueprintId}`.catch(() => undefined);
  }
  if (created.generationProfileIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_generation_profiles"
      WHERE "id" IN (${Prisma.join(created.generationProfileIds)})
    `.catch(() => undefined);
  }
  await prisma.$executeRaw`
    DELETE FROM "csca_generation_profiles"
    WHERE "subject" IN (${subject}, ${fixtureSubject}, ${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  if (created.seriesProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_series_profiles"
      WHERE "id" = ${created.seriesProfileId}
    `.catch(() => undefined);
  }
  await prisma.$executeRaw`
    DELETE FROM "csca_exam_series_profiles"
    WHERE "subject" IN (${subject}, ${fixtureSubject}, ${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  if (created.styleProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_style_profiles"
      WHERE "id" = ${created.styleProfileId}
    `.catch(() => undefined);
  }
  await prisma.$executeRaw`
    DELETE FROM "csca_question_style_profiles"
    WHERE "subject" IN (${subject}, ${fixtureSubject}, ${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  await prisma.$executeRaw`
    DELETE FROM "csca_source_questions"
    WHERE "subject" IN (${subject}, ${fixtureSubject}, ${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  await prisma.$executeRaw`
    DELETE FROM "csca_source_documents"
    WHERE "subject" IN (${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  await prisma.$executeRaw`
    DELETE FROM "csca_syllabus_imports"
    WHERE "subject" IN (${diagnosticSubject}, ${blockedSubject}, ${lowConfidenceSubject}, ${outOfSyllabusSubject})
  `.catch(() => undefined);
  if (created.syllabusImportId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_syllabus_imports"
      WHERE "id" = ${created.syllabusImportId}
    `.catch(() => undefined);
  }
  if (created.importSyllabusImportId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_syllabus_imports"
      WHERE "id" = ${created.importSyllabusImportId}
    `.catch(() => undefined);
  }
  if (created.fixtureSyllabusImportId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_syllabus_imports"
      WHERE "id" = ${created.fixtureSyllabusImportId}
    `.catch(() => undefined);
  }
  if (created.importDocumentIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_source_documents"
      WHERE "id" IN (${Prisma.join(created.importDocumentIds)})
    `.catch(() => undefined);
  }
  if (created.documentIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_source_documents"
      WHERE "id" IN (${Prisma.join(created.documentIds)})
    `.catch(() => undefined);
  }
  if (created.importTopicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.importTopicId}`.catch(() => undefined);
  }
  if (created.fixtureTopicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.fixtureTopicId}`.catch(() => undefined);
  }
  if (created.blockedTopicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.blockedTopicId}`.catch(() => undefined);
  }
  if (created.lowConfidenceTopicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.lowConfidenceTopicId}`.catch(() => undefined);
  }
  if (created.outOfSyllabusTopicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.outOfSyllabusTopicId}`.catch(() => undefined);
  }
  if (created.topicId) {
    await prisma.$executeRaw`DELETE FROM "csca_exam_topics" WHERE "id" = ${created.topicId}`.catch(() => undefined);
  }
}

async function setupDiagnosticSourceMappingGap() {
  await prisma.$executeRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "applied_at", "created_at", "updated_at"
    )
    VALUES (
      ${diagnosticSubject}, ${diagnosticSyllabusVersion}, 'Smoke diagnostic mapping-gap syllabus', 'applied',
      ${JSON.stringify({
        schemaVersion: 'csca-syllabus-v1',
        subject: diagnosticSubject,
        syllabusVersion: diagnosticSyllabusVersion,
        topics: [{ code: `M-DIAGNOSTIC-${suffix}`, title: 'Smoke Diagnostic Topic' }]
      })}::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  const [document] = await prisma.$queryRaw`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language", "file_hash",
      "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${diagnosticSubject}, 'past_paper', ${`Smoke diagnostic mapping gap ${suffix}`},
      2026, '2026-diagnostic', 'en', ${sha256({ kind: 'diagnostic-source-gap', suffix })},
      ${`Smoke diagnostic ${suffix}`}, 'internal_analysis',
      ${JSON.stringify({ allowStyleExtraction: true, allowSimilarityReference: true, allowDirectReuse: false })}::jsonb,
      'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  await prisma.$executeRaw`
    INSERT INTO "csca_source_questions" (
      "document_id", "subject", "question_number", "language", "prompt_hash", "prompt_text",
      "options", "correct_answer", "explanation", "syllabus_version", "topic_id", "topic_codes",
      "analysis", "analysis_status", "analysis_confidence", "analysis_issues", "review_status",
      "auto_profile_status", "auto_profile_attempts", "updated_at"
    )
    VALUES (
      ${document.id}, ${diagnosticSubject}, '1', 'en', ${sha256({ diagnosticSubject, suffix, q: 1 })},
      'Smoke diagnostic unmapped source question should not be shown as no pipeline task.',
      ${JSON.stringify([
        { id: 'A', text: '1' },
        { id: 'B', text: '2' },
        { id: 'C', text: '3' },
        { id: 'D', text: '4' }
      ])}::jsonb,
      'A', 'Smoke diagnostic answer.', ${diagnosticSyllabusVersion}, NULL, '[]'::jsonb,
      ${JSON.stringify({
        schemaVersion: 'source-question-profile-v2',
        difficulty: 'medium',
        questionForm: 'calculation_application',
        cognitiveSkill: 'standard_application',
        readingLoad: 'low',
        calculationLoad: 'light'
      })}::jsonb,
      'ai_parsed', 0.96, '[]'::jsonb, 'needs_review',
      'auto_approved', 1, CURRENT_TIMESTAMP
    )
  `;
}

async function setupBlockedSourceMappingCoverage() {
  await prisma.$executeRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "applied_at", "created_at", "updated_at"
    )
    VALUES (
      ${blockedSubject}, ${blockedSyllabusVersion}, 'Smoke blocked mapping coverage syllabus', 'applied',
      ${JSON.stringify({
        schemaVersion: 'csca-syllabus-v1',
        subject: blockedSubject,
        syllabusVersion: blockedSyllabusVersion,
        topics: [{ code: blockedTopicCode, title: 'Smoke Blocked Coverage Topic' }]
      })}::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "exam_scope", "syllabus_version", "status", "updated_at"
    )
    VALUES (
      ${blockedSubject}, 'Smoke Blocked', ${blockedTopicCode}, 'Smoke Blocked Coverage Topic',
      'Smoke topic used to prove incomplete source mapping blocks the profile pipeline.',
      ${blockedSyllabusVersion}, 'published', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.blockedTopicId = topic.id;
  const [document] = await prisma.$queryRaw`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language", "file_hash",
      "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${blockedSubject}, 'past_paper', ${`Smoke blocked mapping coverage ${suffix}`},
      2026, '2026-blocked', 'en', ${sha256({ kind: 'blocked-source-coverage', suffix })},
      ${`Smoke blocked coverage ${suffix}`}, 'internal_analysis',
      ${JSON.stringify({ allowStyleExtraction: true, allowSimilarityReference: true, allowDirectReuse: false })}::jsonb,
      'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.importDocumentIds.push(document.id);

  for (let index = 1; index <= 10; index += 1) {
    const isMapped = index <= 8;
    await prisma.$executeRaw`
      INSERT INTO "csca_source_questions" (
        "document_id", "subject", "question_number", "language", "prompt_hash", "prompt_text",
        "options", "correct_answer", "explanation", "syllabus_version", "topic_id", "topic_codes",
        "analysis", "analysis_status", "analysis_confidence", "analysis_issues", "review_status",
        "auto_profile_status", "auto_profile_attempts", "auto_profile_decided_at", "auto_profile_decision",
        "auto_profile_gate_result", "updated_at"
      )
      VALUES (
        ${document.id}, ${blockedSubject}, ${String(index)}, 'en', ${sha256({ blockedSubject, suffix, index })},
        ${`Smoke blocked coverage Q${index}: mapped coverage must stay below the pipeline threshold.`},
        ${JSON.stringify([
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' }
        ])}::jsonb,
        'A', 'Smoke blocked coverage answer.', ${blockedSyllabusVersion},
        ${isMapped ? topic.id : null},
        ${JSON.stringify(isMapped ? [blockedTopicCode] : [])}::jsonb,
        ${JSON.stringify(sourceAnalysis(index))}::jsonb,
        'ai_parsed', 0.96, '[]'::jsonb, ${isMapped ? 'approved' : 'needs_review'},
        'auto_approved', 1, CURRENT_TIMESTAMP,
        ${JSON.stringify({ decision: 'auto_approved', source: 'smoke' })}::jsonb,
        ${JSON.stringify({ gate: { decision: 'passed', score: 90 } })}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

async function setupBlockedSourceMappingDiagnosis({
  subjectName,
  syllabus,
  topicCodeValue,
  title,
  kind
}) {
  await prisma.$executeRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "applied_at", "created_at", "updated_at"
    )
    VALUES (
      ${subjectName}, ${syllabus}, ${`${title} syllabus`}, 'applied',
      ${JSON.stringify({
        schemaVersion: 'csca-syllabus-v1',
        subject: subjectName,
        syllabusVersion: syllabus,
        topics: [{ code: topicCodeValue, title }]
      })}::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "exam_scope", "syllabus_version", "status", "updated_at"
    )
    VALUES (
      ${subjectName}, 'Smoke Diagnosis', ${topicCodeValue}, ${title},
      ${`${title} proves mapping-gap diagnosis is not collapsed into generic coverage low.`},
      ${syllabus}, 'published', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  if (kind === 'low_confidence') created.lowConfidenceTopicId = topic.id;
  if (kind === 'out_of_syllabus') created.outOfSyllabusTopicId = topic.id;

  const [document] = await prisma.$queryRaw`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language", "file_hash",
      "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${subjectName}, 'past_paper', ${`${title} ${suffix}`},
      2026, ${`2026-${kind}`}, 'en', ${sha256({ kind, suffix })},
      ${`${title} ${suffix}`}, 'internal_analysis',
      ${JSON.stringify({ allowStyleExtraction: true, allowSimilarityReference: true, allowDirectReuse: false })}::jsonb,
      'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.importDocumentIds.push(document.id);

  for (let index = 1; index <= 10; index += 1) {
    const isMapped = index <= 8;
    const analysisConfidence = isMapped ? 0.96 : kind === 'low_confidence' ? 0.62 : 0.94;
    await prisma.$executeRaw`
      INSERT INTO "csca_source_questions" (
        "document_id", "subject", "question_number", "language", "prompt_hash", "prompt_text",
        "options", "correct_answer", "explanation", "syllabus_version", "topic_id", "topic_codes",
        "analysis", "analysis_status", "analysis_confidence", "analysis_issues", "review_status",
        "auto_profile_status", "auto_profile_attempts", "auto_profile_decided_at", "auto_profile_decision",
        "auto_profile_gate_result", "auto_profile_failure_type", "updated_at"
      )
      VALUES (
        ${document.id}, ${subjectName}, ${String(index)}, 'en', ${sha256({ subjectName, suffix, index, kind })},
        ${`${title} Q${index}: diagnosis-specific blocked source profile sample.`},
        ${JSON.stringify([
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' }
        ])}::jsonb,
        'A', ${`${title} answer.`}, ${syllabus},
        ${isMapped ? topic.id : null},
        ${JSON.stringify(isMapped ? [topicCodeValue] : [])}::jsonb,
        ${JSON.stringify(sourceAnalysis(index))}::jsonb,
        'ai_parsed', ${analysisConfidence}, '[]'::jsonb, ${isMapped ? 'approved' : 'needs_review'},
        'auto_approved', 1, CURRENT_TIMESTAMP,
        ${JSON.stringify({ decision: 'auto_approved', source: 'smoke', kind })}::jsonb,
        ${JSON.stringify({ gate: { decision: isMapped ? 'passed' : 'needs_review', score: isMapped ? 90 : 60 } })}::jsonb,
        ${!isMapped && kind === 'out_of_syllabus' ? 'out_of_syllabus' : null},
        CURRENT_TIMESTAMP
      )
    `;
  }
}

async function setupImportSubjectBaseline() {
  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "exam_scope", "syllabus_version", "status", "updated_at"
    )
    VALUES (
      ${importSubject}, 'Smoke Import', ${importTopicCode}, 'Smoke Import Auto Pipeline Topic',
      'Smoke import source JSON should trigger source profile pipeline automatically.',
      ${importSyllabusVersion}, 'published', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.importTopicId = topic.id;
}

async function setupFixtureSubjectBaseline() {
  const [syllabusImport] = await prisma.$queryRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "applied_at", "created_at", "updated_at"
    )
    VALUES (
      ${fixtureSubject}, ${fixtureSyllabusVersion}, 'Smoke real 48-question fixture syllabus', 'applied',
      ${JSON.stringify({
        schemaVersion: 'csca-syllabus-v1',
        subject: fixtureSubject,
        syllabusVersion: fixtureSyllabusVersion,
        topics: [{ code: fixtureTopicCode, title: 'Real Fixture Smoke Topic' }]
      })}::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.fixtureSyllabusImportId = syllabusImport.id;

  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "exam_scope", "syllabus_version", "status", "updated_at"
    )
    VALUES (
      ${fixtureSubject}, 'Smoke Fixture', ${fixtureTopicCode}, 'Real Fixture Smoke Topic',
      'Smoke topic used to prove a real 48-question source JSON can pass the auto-profile and source-profile pipeline.',
      ${fixtureSyllabusVersion}, 'published', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.fixtureTopicId = topic.id;
}

async function setupSourceSeries() {
  const [syllabusImport] = await prisma.$queryRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "applied_at", "created_at", "updated_at"
    )
    VALUES (
      ${subject}, ${syllabusVersion}, 'Smoke continuous generation profile syllabus', 'applied',
      ${JSON.stringify({
        schemaVersion: 'csca-syllabus-v1',
        subject,
        syllabusVersion,
        topics: [{ code: topicCode, title: 'Continuous Series Smoke Topic' }]
      })}::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.syllabusImportId = syllabusImport.id;

  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "exam_scope", "syllabus_version", "status", "updated_at"
    )
    VALUES (
      ${subject}, 'Smoke', ${topicCode}, 'Continuous Series Smoke Topic',
      'Smoke scope for continuous exam-series profile.', ${syllabusVersion}, 'published', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.topicId = topic.id;

  for (const [documentIndex, session] of ['2026-01', '2026-02'].entries()) {
    const [document] = await prisma.$queryRaw`
      INSERT INTO "csca_source_documents" (
        "subject", "source_type", "title", "exam_year", "exam_session", "language", "file_hash",
        "source_label", "license_scope", "usage_policy", "status", "updated_at"
      )
      VALUES (
        ${subject}, ${documentIndex === 0 ? 'past_paper' : 'prediction_paper'},
        ${`Smoke source paper ${session}`}, 2026, ${session}, 'zh',
        ${sha256({ syllabusVersion, session })}, ${`Smoke ${session}`}, 'internal_analysis',
        ${JSON.stringify({ allowStyleExtraction: true, allowSimilarityReference: true, allowDirectReuse: false })}::jsonb,
        'active', CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `;
    created.documentIds.push(document.id);

    for (let i = 1; i <= 6; i += 1) {
      const absoluteIndex = documentIndex * 6 + i;
      const prompt = `Smoke ${session} Q${i}: f(x)=x+${absoluteIndex}, 求 f(${i})。`;
      const [question] = await prisma.$queryRaw`
        INSERT INTO "csca_source_questions" (
          "document_id", "subject", "question_number", "language", "prompt_hash", "prompt_text",
          "options", "correct_answer", "explanation", "syllabus_version", "topic_id", "topic_codes",
          "blueprint_like_tags", "analysis", "analysis_status", "analysis_confidence", "analysis_issues",
          "review_status", "auto_profile_status", "auto_profile_attempts", "auto_profile_decided_at", "auto_profile_decision",
          "auto_profile_gate_result", "updated_at"
        )
        VALUES (
          ${document.id}, ${subject}, ${String(i)}, 'zh', ${sha256(prompt)}, ${prompt},
          ${JSON.stringify([
            { id: 'A', text: String(i + absoluteIndex) },
            { id: 'B', text: String(i + absoluteIndex + 1) },
            { id: 'C', text: String(i + absoluteIndex + 2) },
            { id: 'D', text: String(i + absoluteIndex + 3) }
          ])}::jsonb,
          'A', ${`f(${i})=${i + absoluteIndex}`}, ${syllabusVersion}, ${created.topicId},
          ${JSON.stringify([topicCode])}::jsonb, ${JSON.stringify(['smoke-series'])}::jsonb,
          ${JSON.stringify(sourceAnalysis(absoluteIndex))}::jsonb, 'ai_parsed', 0.96, '[]'::jsonb,
          'approved', 'auto_approved', 1, CURRENT_TIMESTAMP,
          ${JSON.stringify({ decision: 'auto_approved', source: 'smoke' })}::jsonb,
          ${JSON.stringify({ gate: { decision: 'passed', score: 96 } })}::jsonb,
          CURRENT_TIMESTAMP
        )
        RETURNING "id"
      `;
      created.sourceQuestionIds.push(question.id);
    }
  }

  const profile = {
    schemaVersion: 'topic-questioning-profile-v2',
    subject,
    syllabusVersion,
    scopeType: 'subject',
    sampleSize: created.sourceQuestionIds.length,
    confidence: 'medium',
    difficultyDistribution: { basic: 0.33, medium: 0.42, hard: 0.25 },
    questionFormDistribution: { calculation_application: 0.58, concept_judgement: 0.42 },
    cognitiveSkillDistribution: { standard_application: 0.58, concept_judgement: 0.42 },
    generationGuidelines: ['Smoke profile guideline: generate original questions from trend signals only.']
  };
  const [styleProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_question_style_profiles" (
      "subject", "syllabus_version", "scope_type", "scope_id", "source_question_ids",
      "sample_size", "confidence", "profile", "profile_version", "source_question_snapshot_hash",
      "status", "generated_by", "generated_at", "updated_at"
    )
    VALUES (
      ${subject}, ${syllabusVersion}, 'subject', NULL, ${JSON.stringify(created.sourceQuestionIds)}::jsonb,
      ${created.sourceQuestionIds.length}, 'medium', ${JSON.stringify(profile)}::jsonb, 2,
      ${sha256(created.sourceQuestionIds)}, 'active', 'smoke', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.styleProfileId = styleProfile.id;
}

async function importAndRunRealFixture(service, startedTaskIds, relativePath, label, expectedCount, expectedMappedCount) {
  const fixturePayload = loadSourceJsonFixture(relativePath);
  const fixtureImport = await service.importSourceDocumentJson({
    document: {
      ...fixturePayload.document,
      subject: fixtureSubject,
      syllabusVersion: fixtureSyllabusVersion,
      title: `Smoke fixture import ${label} ${suffix}`,
      sourceLabel: `Smoke fixture import ${label} ${suffix}`,
      fileHash: sha256({ kind: 'source-json-fixture-import', label, suffix }),
      status: 'active'
    },
    questions: fixturePayload.questions.map((question, index) => ({
      ...question,
      syllabusVersion: fixtureSyllabusVersion,
      analysis: {
        ...(question.analysis ?? {}),
        aiTopicMapping: {
          status: 'success',
          suggestions: [{
            topicCode: fixtureTopicCode,
            confidence: 0.96,
            reason: `Smoke fixture uses the preserved source JSON topic mapping path for ${label} question ${index + 1}.`
          }]
        }
      },
      analysisConfidence: 0.96,
      analysisIssues: [],
      reviewStatus: 'mapped'
    }))
  });
  created.importDocumentIds.push(fixtureImport.document.id);
  if (fixtureImport.autoProfileTask?.id) created.taskIds.push(fixtureImport.autoProfileTask.id);
  if (fixtureImport.sourceProfilePipelineTask?.id) created.taskIds.push(fixtureImport.sourceProfilePipelineTask.id);
  assert(fixtureImport.createdQuestions === expectedCount, `Real ${label} fixture import should create ${expectedCount} source questions, got ${fixtureImport.createdQuestions}.`);
  assert(fixtureImport.autoProfileTask?.action === 'auto_profile_filtered', `Real ${label} fixture import should create an auto-profile task.`);
  assert(fixtureImport.sourceProfilePipelineTask?.action === 'source_document_imported', `Real ${label} fixture import should create a source profile pipeline task.`);
  assert(startedTaskIds.includes(fixtureImport.autoProfileTask.id), `Real ${label} import should attempt to start the source-question auto-profile runner automatically.`);
  assert(startedTaskIds.includes(fixtureImport.sourceProfilePipelineTask.id), `Real ${label} import should attempt to start the source-profile pipeline runner automatically.`);

  const [fixtureStatus] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "questionCount",
      COUNT(*) FILTER (WHERE "auto_profile_status" = 'pending')::int AS "pendingCount"
    FROM "csca_source_questions"
    WHERE "document_id" = ${fixtureImport.document.id}
  `;
  assert(fixtureStatus?.questionCount === expectedCount, `Fixture ${label} source document should persist ${expectedCount} questions, got ${fixtureStatus?.questionCount}.`);
  assert(fixtureStatus?.pendingCount === expectedCount, `Fixture ${label} import should initialize all source questions as pending auto-profile, got ${fixtureStatus?.pendingCount}.`);

  await service.runSourceQuestionAutoProfileTask(fixtureImport.autoProfileTask.id, {
    action: 'auto_profile_filtered',
    subject: fixtureSubject,
    documentId: fixtureImport.document.id,
    syllabusVersion: fixtureSyllabusVersion,
    limit: 100,
    autoRefreshStyleProfile: true,
    autoRetry: true
  });
  const { task: fixtureAutoProfileTask } = await service.getSourceQuestionAutoProfileTask(fixtureImport.autoProfileTask.id);
  assert(fixtureAutoProfileTask.status === 'succeeded', `Real ${label} fixture auto-profile task should succeed, got ${fixtureAutoProfileTask.status}.`);
  assert(
    fixtureAutoProfileTask.succeeded === expectedCount,
    `Real ${label} fixture auto-profile task should approve ${expectedCount} samples, got ${fixtureAutoProfileTask.succeeded}: ${JSON.stringify(fixtureAutoProfileTask.result ?? null)}.`
  );

  await service.runSourceProfilePipelineTask(fixtureImport.sourceProfilePipelineTask.id, {
    action: 'source_document_imported',
    trigger: 'source_document_imported',
    subject: fixtureSubject,
    documentId: fixtureImport.document.id,
    syllabusVersion: fixtureSyllabusVersion
  });
  const [fixturePipelineTask] = await prisma.$queryRaw`
    SELECT "status", "result"
    FROM "csca_ai_questioning_tasks"
    WHERE "id" = ${fixtureImport.sourceProfilePipelineTask.id}::uuid
    LIMIT 1
  `;
  assert(
    fixturePipelineTask?.status === 'succeeded',
    `Real ${label} fixture source profile pipeline should succeed, got ${fixturePipelineTask?.status}: ${JSON.stringify(fixturePipelineTask?.result ?? null)}.`
  );
  assert(fixturePipelineTask?.result?.stage === 'ready', `Real ${label} fixture source profile pipeline should finish at ready stage, got ${fixturePipelineTask?.result?.stage}.`);
  assert(fixturePipelineTask?.result?.mapping?.mappedCount === expectedMappedCount, `Real ${label} fixture pipeline should map ${expectedMappedCount} active questions, got ${fixturePipelineTask?.result?.mapping?.mappedCount}.`);
  assert(fixturePipelineTask?.result?.profiles?.subjectPracticeGenerationProfile === 'succeeded', `Real ${label} fixture pipeline should generate subject-practice generation profile.`);
  assert(fixturePipelineTask?.result?.profiles?.onlineMockExamGenerationProfile === 'succeeded', `Real ${label} fixture pipeline should generate online-mock generation profile.`);
  return { fixtureImport, fixturePipelineTask };
}

async function main() {
  await setupSourceSeries();
  await setupImportSubjectBaseline();
  await setupFixtureSubjectBaseline();
  await setupDiagnosticSourceMappingGap();
  await setupBlockedSourceMappingCoverage();
  await setupBlockedSourceMappingDiagnosis({
    subjectName: lowConfidenceSubject,
    syllabus: lowConfidenceSyllabusVersion,
    topicCodeValue: lowConfidenceTopicCode,
    title: 'Smoke Low Confidence Mapping',
    kind: 'low_confidence'
  });
  await setupBlockedSourceMappingDiagnosis({
    subjectName: outOfSyllabusSubject,
    syllabus: outOfSyllabusVersion,
    topicCodeValue: outOfSyllabusTopicCode,
    title: 'Smoke Out Of Syllabus Mapping',
    kind: 'out_of_syllabus'
  });
  const service = new AIQuestioningService(
    prisma,
    new QuestionGeneratorService(),
    { generate: async () => { throw new Error('Smoke should not call generator provider.'); } },
    new QuestionReviewerService(new QuestionValidatorService(), { review: async () => ({ issues: [], dimensions: [] }) }),
    new QuestionTopicMapperProviderService(disabledGateway()),
    new QuestionQualityService(prisma)
  );
  const startedTaskIds = [];
  service.startAiQuestioningTaskRunner = (id) => {
    startedTaskIds.push(id);
    return { started: false, reason: 'smoke_manual_runner' };
  };

  const diagnosticSummary = await service.sourceReferenceSummary({
    subject: diagnosticSubject,
    syllabusVersion: diagnosticSyllabusVersion,
    refresh: true
  });
  assert(
    diagnosticSummary?.summary?.pipelineTask?.action === 'summary_diagnostic',
    `Source reference summary should expose summary_diagnostic when active source mappings are incomplete but no pipeline task exists, got ${JSON.stringify(diagnosticSummary?.summary?.pipelineTask ?? null)}.`
  );
  assert(
    diagnosticSummary.summary.pipelineTask.status === 'source_mapping_incomplete',
    `Source reference summary diagnostic should be source_mapping_incomplete, got ${diagnosticSummary.summary.pipelineTask.status}.`
  );
  assert(
    diagnosticSummary.summary.pipelineTask.result?.mappingGapDiagnosis?.unmappedCount === 1,
    `Source reference summary diagnostic should report one unmapped question, got ${JSON.stringify(diagnosticSummary.summary.pipelineTask.result ?? null)}.`
  );

  const blockedPipeline = await service.startSourceProfilePipelineManualRebuild({
    subject: blockedSubject,
    syllabusVersion: blockedSyllabusVersion
  });
  assert(blockedPipeline.task?.id, 'Blocked mapping-coverage source profile pipeline should create a task.');
  created.taskIds.push(blockedPipeline.task.id);
  await service.runSourceProfilePipelineTask(blockedPipeline.task.id, {
    action: 'manual_rebuild',
    trigger: 'manual_rebuild',
    subject: blockedSubject,
    syllabusVersion: blockedSyllabusVersion
  });
  const [blockedPipelineTask] = await prisma.$queryRaw`
    SELECT "status", "error", "result"
    FROM "csca_ai_questioning_tasks"
    WHERE "id" = ${blockedPipeline.task.id}::uuid
    LIMIT 1
  `;
  assert(
    blockedPipelineTask?.status === 'blocked',
    `Incomplete source mapping coverage must block the source profile pipeline, got ${blockedPipelineTask?.status}: ${JSON.stringify(blockedPipelineTask?.result ?? null)}.`
  );
  assert(
    blockedPipelineTask?.error === 'source_mapping_coverage_low',
    `Blocked mapping-coverage pipeline should expose source_mapping_coverage_low, got ${blockedPipelineTask?.error}.`
  );
  assert(
    blockedPipelineTask?.result?.mapping?.mappedCount === 8 && blockedPipelineTask?.result?.mapping?.unmappedCount === 2,
    `Blocked mapping-coverage pipeline should preserve mapped/unmapped counts, got ${JSON.stringify(blockedPipelineTask?.result?.mapping ?? null)}.`
  );
  assert(
    blockedPipelineTask?.result?.mappingGapDiagnosis?.coverage === 0.8,
    `Blocked mapping-coverage pipeline should expose coverage 0.8, got ${JSON.stringify(blockedPipelineTask?.result?.mappingGapDiagnosis ?? null)}.`
  );

  async function assertBlockedPipelineDiagnosis(subjectName, syllabus, expectedReason, expectedField, expectedCount) {
    const started = await service.startSourceProfilePipelineManualRebuild({
      subject: subjectName,
      syllabusVersion: syllabus
    });
    assert(started.task?.id, `${expectedReason} source profile pipeline should create a task.`);
    created.taskIds.push(started.task.id);
    await service.runSourceProfilePipelineTask(started.task.id, {
      action: 'manual_rebuild',
      trigger: 'manual_rebuild',
      subject: subjectName,
      syllabusVersion: syllabus
    });
    const [task] = await prisma.$queryRaw`
      SELECT "status", "error", "result"
      FROM "csca_ai_questioning_tasks"
      WHERE "id" = ${started.task.id}::uuid
      LIMIT 1
    `;
    assert(
      task?.status === 'blocked',
      `${expectedReason} pipeline should block instead of succeeding, got ${task?.status}: ${JSON.stringify(task?.result ?? null)}.`
    );
    assert(
      task?.error === expectedReason,
      `${expectedReason} pipeline should persist specific task error, got ${task?.error}.`
    );
    assert(
      task?.result?.reason === expectedReason && task?.result?.mappingGapDiagnosis?.reason === expectedReason,
      `${expectedReason} pipeline should expose specific result reason and diagnosis, got ${JSON.stringify(task?.result ?? null)}.`
    );
    assert(
      task?.result?.mappingGapDiagnosis?.[expectedField] === expectedCount,
      `${expectedReason} pipeline should expose ${expectedField}=${expectedCount}, got ${JSON.stringify(task?.result?.mappingGapDiagnosis ?? null)}.`
    );
    assert(
      task?.result?.mappingGapDiagnosis?.coverage === 0.8,
      `${expectedReason} pipeline should preserve coverage 0.8, got ${JSON.stringify(task?.result?.mappingGapDiagnosis ?? null)}.`
    );
  }

  await assertBlockedPipelineDiagnosis(
    lowConfidenceSubject,
    lowConfidenceSyllabusVersion,
    'low_confidence_mapping_review_required',
    'lowConfidenceCount',
    2
  );
  await assertBlockedPipelineDiagnosis(
    outOfSyllabusSubject,
    outOfSyllabusVersion,
    'out_of_syllabus_review_required',
    'outOfSyllabusCount',
    2
  );

  await importAndRunRealFixture(
    service,
    startedTaskIds,
    'docs/csca-math-past-paper-2025-12-en-source.json',
    '2025-12',
    48,
    48
  );
  const [firstFixtureSeriesProfile] = await prisma.$queryRaw`
    SELECT "id", "sample_size" AS "sampleSize", "status"
    FROM "csca_exam_series_profiles"
    WHERE "subject" = ${fixtureSubject}
      AND "syllabus_version" = ${fixtureSyllabusVersion}
      AND "status" = 'active'
    ORDER BY "id" DESC
    LIMIT 1
  `;
  const firstFixtureGenerationProfiles = await prisma.$queryRaw`
    SELECT "id", "use_case" AS "useCase", "status"
    FROM "csca_generation_profiles"
    WHERE "subject" = ${fixtureSubject}
      AND "syllabus_version" = ${fixtureSyllabusVersion}
      AND "status" = 'active'
    ORDER BY "id" ASC
  `;
  assert(firstFixtureSeriesProfile?.sampleSize === 48, `First real fixture trend profile should sample 48 questions, got ${firstFixtureSeriesProfile?.sampleSize}.`);
  assert(firstFixtureGenerationProfiles.length === 2, `First real fixture pipeline should create two active generation profiles, got ${firstFixtureGenerationProfiles.length}.`);

  await importAndRunRealFixture(
    service,
    startedTaskIds,
    'docs/csca-math-past-paper-2026-03-en-source.json',
    '2026-03',
    48,
    96
  );
  const [secondFixtureSeriesProfile] = await prisma.$queryRaw`
    SELECT "id", "sample_size" AS "sampleSize", "source_document_ids" AS "sourceDocumentIds", "source_question_ids" AS "sourceQuestionIds", "status"
    FROM "csca_exam_series_profiles"
    WHERE "subject" = ${fixtureSubject}
      AND "syllabus_version" = ${fixtureSyllabusVersion}
      AND "status" = 'active'
    ORDER BY "id" DESC
    LIMIT 1
  `;
  const secondFixtureGenerationProfiles = await prisma.$queryRaw`
    SELECT "id", "use_case" AS "useCase", "series_profile_id" AS "seriesProfileId", "status"
    FROM "csca_generation_profiles"
    WHERE "subject" = ${fixtureSubject}
      AND "syllabus_version" = ${fixtureSyllabusVersion}
      AND "status" = 'active'
    ORDER BY "id" ASC
  `;
  assert(secondFixtureSeriesProfile?.id !== firstFixtureSeriesProfile?.id, 'Second real fixture import should activate a newer trend profile.');
  assert(secondFixtureSeriesProfile?.sampleSize === 96, `Second real fixture trend profile should cover two active 48-question past papers, got sample=${secondFixtureSeriesProfile?.sampleSize}.`);
  assert(secondFixtureSeriesProfile?.sourceDocumentIds?.length === 2, `Second real fixture trend profile should include two source documents, got ${JSON.stringify(secondFixtureSeriesProfile?.sourceDocumentIds ?? null)}.`);
  assert(secondFixtureSeriesProfile?.sourceQuestionIds?.length === 96, `Second real fixture trend profile should include 96 source questions, got ${secondFixtureSeriesProfile?.sourceQuestionIds?.length}.`);
  assert(secondFixtureGenerationProfiles.length === 2, `Second real fixture pipeline should keep exactly two active generation profiles, got ${secondFixtureGenerationProfiles.length}.`);
  for (const profile of secondFixtureGenerationProfiles) {
    assert(profile.seriesProfileId === secondFixtureSeriesProfile.id, `Second real fixture ${profile.useCase} generation profile should reference the newest trend profile.`);
    assert(!firstFixtureGenerationProfiles.some((oldProfile) => oldProfile.id === profile.id), `Second real fixture should supersede old ${profile.useCase} generation profile.`);
  }
  const supersededOldFixtureProfiles = await prisma.$queryRaw`
    SELECT "id", "status"
    FROM "csca_generation_profiles"
    WHERE "id" IN (${Prisma.join(firstFixtureGenerationProfiles.map((profile) => profile.id))})
    ORDER BY "id" ASC
  `;
  assert(
    supersededOldFixtureProfiles.every((profile) => profile.status === 'superseded'),
    `First fixture generation profiles should be superseded after second real month import, got ${JSON.stringify(supersededOldFixtureProfiles)}.`
  );

  const imported = await service.importSourceDocumentJson({
    document: {
      subject: importSubject,
      syllabusVersion: importSyllabusVersion,
      sourceType: 'past_paper',
      title: `Smoke Import Past Paper ${suffix}`,
      sourceLabel: `Smoke Import Past Paper ${suffix}`,
      examYear: 2026,
      examSession: '2026-smoke',
      language: 'en',
      fileHash: sha256({ kind: 'source-import-auto-pipeline', suffix })
    },
    questions: [1, 2].map((index) => ({
      questionNumber: String(index),
      prompt: `Smoke import Q${index}: if x=${index}, what is x+1?`,
      options: [
        { id: 'A', text: String(index + 1) },
        { id: 'B', text: String(index + 2) },
        { id: 'C', text: String(index + 3) },
        { id: 'D', text: String(index + 4) }
      ],
      correctAnswer: 'A',
      explanation: 'Add one.',
      syllabusVersion: importSyllabusVersion,
      topicCodes: [importTopicCode],
      analysis: {
        ...sourceAnalysis(index),
        aiTopicMapping: {
          status: 'success',
          suggestions: [{
            topicCode: importTopicCode,
            confidence: 0.96,
            reason: 'Smoke import JSON already carries a successful topic mapping.'
          }]
        }
      },
      analysisConfidence: 0.96,
      reviewStatus: 'mapped'
    }))
  });
  created.importDocumentIds.push(imported.document.id);
  const importedQuestionIds = (imported.questions ?? [])
    .map((question) => Number(question.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  created.sourceQuestionIds.push(...importedQuestionIds);
  if (imported.autoProfileTask?.id) created.taskIds.push(imported.autoProfileTask.id);
  if (imported.sourceProfilePipelineTask?.id) created.taskIds.push(imported.sourceProfilePipelineTask.id);
  assert(imported.createdQuestions === 2, `Source JSON import should create two source questions, got ${imported.createdQuestions}.`);
  assert(imported.autoProfileTask?.action === 'auto_profile_filtered', 'Source JSON import should create a source-question auto-profile task.');
  assert(imported.sourceProfilePipelineTask?.action === 'source_document_imported', 'Source JSON import should create a source_document_imported pipeline task.');
  assert(imported.sourceProfilePipelineTask?.trigger === 'source_document_imported', 'Source JSON import pipeline task should preserve source_document_imported trigger metadata.');
  assert(startedTaskIds.includes(imported.autoProfileTask.id), 'Import should attempt to start the source-question auto-profile runner automatically.');
  assert(startedTaskIds.includes(imported.sourceProfilePipelineTask.id), 'Import should attempt to start the source-profile pipeline runner automatically.');

  await service.runSourceQuestionAutoProfileTask(imported.autoProfileTask.id, {
    action: 'auto_profile_filtered',
    subject: importSubject,
    documentId: imported.document.id,
    syllabusVersion: importSyllabusVersion,
    limit: 500,
    autoRefreshStyleProfile: true,
    autoRetry: true
  });
  const { task: importAutoProfileTask } = await service.getSourceQuestionAutoProfileTask(imported.autoProfileTask.id);
  assert(importAutoProfileTask.status === 'succeeded', `Imported source auto-profile task should succeed, got ${importAutoProfileTask.status}.`);
  assert(importAutoProfileTask.succeeded === 2, `Imported source auto-profile task should approve two samples, got ${importAutoProfileTask.succeeded}.`);

  await service.runSourceProfilePipelineTask(imported.sourceProfilePipelineTask.id, {
    action: 'source_document_imported',
    trigger: 'source_document_imported',
    subject: importSubject,
    documentId: imported.document.id,
    syllabusVersion: importSyllabusVersion
  });
  const [importPipelineTask] = await prisma.$queryRaw`
    SELECT "status", "result"
    FROM "csca_ai_questioning_tasks"
    WHERE "id" = ${imported.sourceProfilePipelineTask.id}::uuid
    LIMIT 1
  `;
  assert(
    importPipelineTask?.status === 'succeeded',
    `Imported source profile pipeline should succeed, got ${importPipelineTask?.status}: ${JSON.stringify(importPipelineTask?.result ?? null)}.`
  );
  assert(importPipelineTask?.result?.stage === 'ready', `Imported source profile pipeline should finish at ready stage, got ${importPipelineTask?.result?.stage}.`);
  assert(importPipelineTask?.result?.profiles?.seriesProfile === 'succeeded', 'Imported source profile pipeline should generate a trend profile.');
  assert(importPipelineTask?.result?.profiles?.subjectPracticeGenerationProfile === 'succeeded', 'Imported source profile pipeline should generate subject-practice generation profile.');
  assert(importPipelineTask?.result?.profiles?.onlineMockExamGenerationProfile === 'succeeded', 'Imported source profile pipeline should generate online-mock generation profile.');
  assert(importPipelineTask?.result?.autoReplenishmentWake, 'Imported source profile pipeline should record auto replenishment wake result.');

  const series = await service.generateExamSeriesProfile({
    subject,
    syllabusVersion,
    title: `Smoke continuous trend ${suffix}`
  });
  created.seriesProfileId = series.profile.id;
  const expectedPastPaperDocumentIds = [created.documentIds[0], imported.document.id];
  const expectedPastPaperSourceQuestionIds = [
    ...created.sourceQuestionIds.slice(0, 6),
    ...importedQuestionIds
  ];
  assert(series.profile.status === 'active', 'Generated exam-series profile should be active.');
  assert(series.profile.sampleSize === expectedPastPaperSourceQuestionIds.length, `Exam-series profile should include only active past-paper source questions. sample=${series.profile.sampleSize}`);
  assert(series.profile.sourceDocumentIds.length === expectedPastPaperDocumentIds.length, 'Exam-series profile should exclude prediction/mock source documents.');
  for (const documentId of expectedPastPaperDocumentIds) {
    assert(series.profile.sourceDocumentIds.includes(documentId), `Exam-series profile should include active past-paper document ${documentId}.`);
  }
  assert(!series.profile.sourceDocumentIds.includes(created.documentIds[1]), 'Exam-series profile must not include prediction-paper documents.');
  assert(series.profile.sourceQuestionIds.length === expectedPastPaperSourceQuestionIds.length, 'Exam-series profile should exclude prediction/mock source questions.');
  assert(series.profile.trendProfile?.schemaVersion === 'csca-exam-series-trend-profile-v1', 'Exam-series profile must write stable trend schema version.');
  assertNormalizedPaperTarget(series.profile.trendProfile?.normalizedTargets?.onlineMockExam, 'Exam-series profile');

  const subjectPractice = await service.generateGenerationProfile({
    subject,
    syllabusVersion,
    useCase: 'subject_practice',
    seriesProfileId: created.seriesProfileId
  });
  const onlineMock = await service.generateGenerationProfile({
    subject,
    syllabusVersion,
    useCase: 'online_mock_exam',
    seriesProfileId: created.seriesProfileId
  });
  created.generationProfileIds.push(subjectPractice.profile.id, onlineMock.profile.id);

  assert(subjectPractice.profile.status === 'active', 'Subject-practice generation profile should be active.');
  assert(onlineMock.profile.status === 'active', 'Online-mock generation profile should be active.');
  assert(subjectPractice.profile.seriesProfileId === created.seriesProfileId, 'Subject-practice generation profile should reference the trend profile.');
  assert(onlineMock.profile.seriesProfileId === created.seriesProfileId, 'Online-mock generation profile should reference the trend profile.');
  assert(subjectPractice.profile.profile?.source === 'exam_series_profile', 'Subject-practice generation profile should be derived from exam-series profile.');
  assert(onlineMock.profile.targetPolicy?.assembly?.requiredApprovedCount === 48, 'Online-mock generation profile should carry 48-question assembly policy.');
  assertNormalizedPaperTarget(onlineMock.profile.targetPolicy?.normalizedTarget, 'Online-mock generation targetPolicy');
  assertNormalizedPaperTarget(onlineMock.profile.profile?.normalizedTarget, 'Online-mock generation profile');

  const [blueprint] = await prisma.$queryRaw`
    INSERT INTO "csca_question_blueprints" (
      "subject", "topic_id", "difficulty", "question_type", "skill", "source", "constraints", "status", "updated_at"
    )
    VALUES (
      ${subject}, ${created.topicId}, 'medium', 'single_choice', 'continuous series smoke',
      'generation_profile_smoke', '{}'::jsonb, 'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.blueprintId = blueprint.id;

  const queued = await service.enqueueGenerationJobs({
    blueprintIds: [created.blueprintId],
    limit: 1,
    force: true
  });
  assert(queued.enqueued === 1, `Expected one queued generation job, got ${queued.enqueued}.`);
  created.generationJobId = queued.items[0].id;

  const [job] = await prisma.$queryRaw`
    SELECT "prompt_metadata" AS "promptMetadata"
    FROM "csca_ai_generation_jobs"
    WHERE "id" = ${created.generationJobId}
    LIMIT 1
  `;
  assert(job?.promptMetadata?.generationProfileId === subjectPractice.profile.id, 'Queued subject-practice job should record generationProfileId.');
  assert(job?.promptMetadata?.seriesProfileId === created.seriesProfileId, 'Queued subject-practice job should record seriesProfileId.');
  assert(job?.promptMetadata?.generationProfile?.referencePolicy === 'profile_only', 'Queued job should use profile-only reference policy.');
  assert(job?.promptMetadata?.styleProfile?.id === subjectPractice.profile.sourceStyleProfileId, 'Queued job should retain source style profile reference.');

  const supersedingSubjectPractice = await service.generateGenerationProfile({
    subject,
    syllabusVersion,
    useCase: 'subject_practice',
    seriesProfileId: created.seriesProfileId,
    title: `Smoke superseding subject-practice profile ${suffix}`
  });
  created.generationProfileIds.push(supersedingSubjectPractice.profile.id);
  assert(
    supersedingSubjectPractice.profile.id !== subjectPractice.profile.id,
    'Smoke must create a newer active subject-practice generation profile before stale-lineage processing.'
  );

  const processedStaleLineage = await service.processGenerationJobs({
    jobIds: [created.generationJobId],
    limit: 1,
    retryFailed: false,
    useCase: 'subject_practice'
  });
  assert(processedStaleLineage.items.length === 1, `Expected one stale-lineage generation job to be processed, got ${processedStaleLineage.items.length}.`);
  assert(
    processedStaleLineage.items[0].status === 'archived',
    `Stale-lineage queued generation job should be archived before provider execution, got ${processedStaleLineage.items[0].status}.`
  );
  assert(
    processedStaleLineage.items[0].promptMetadata?.archiveNote === 'archived_stale_profile',
    `Stale-lineage queued generation job should record archived_stale_profile, got ${JSON.stringify(processedStaleLineage.items[0].promptMetadata ?? null)}.`
  );

  console.log('CSCA continuous exam-series generation profile smoke passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
