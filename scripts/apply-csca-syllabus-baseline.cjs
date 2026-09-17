const fs = require('node:fs');
const path = require('node:path');
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

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { AdaptiveReplenishmentService } = require('../backend/src/ai-questioning/adaptive-replenishment.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');

loadEnv(path.resolve(__dirname, '..'));

function parseArgs(argv) {
  const options = {
    file: path.resolve(__dirname, '..', 'docs', 'csca-math-syllabus-2025.json'),
    actorId: 1,
    missingTopicAction: 'archive',
    apply: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--file') {
      options.file = path.resolve(argv[++index] || '');
    } else if (arg === '--actor-id') {
      options.actorId = Number.parseInt(argv[++index] || '', 10);
    } else if (arg === '--missing-topic-action') {
      options.missingTopicAction = argv[++index] || options.missingTopicAction;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/apply-csca-syllabus-baseline.cjs [--file docs/csca-math-syllabus-2025.json] [--missing-topic-action archive] [--actor-id 1] [--apply]

Without --apply this command only previews the syllabus import.
With --apply it creates and applies a syllabus import, archives older applied imports for the same subject, and applies the requested missing-topic action.`);
}

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('AI gateway is disabled for syllabus baseline application.');
    }
  };
}

class DisabledGeneratorProvider {
  async generate() {
    throw new Error('Question generation is disabled for syllabus baseline application.');
  }
}

class DisabledReviewerProvider {
  async review() {
    throw new Error('Question review is disabled for syllabus baseline application.');
  }

  agentIdentity() {
    return {
      role: 'reviewer',
      name: 'disabled-reviewer',
      provider: 'disabled',
      model: 'disabled',
      promptVersion: 'disabled'
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!Number.isInteger(options.actorId) || options.actorId <= 0) {
    throw new Error('--actor-id must be a positive integer.');
  }
  if (!['keep', 'draft', 'archive'].includes(options.missingTopicAction)) {
    throw new Error('--missing-topic-action must be one of: keep, draft, archive.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Run this in the backend environment or load the project .env first.');
  }
  if (!fs.existsSync(options.file)) {
    throw new Error(`Syllabus JSON file not found: ${options.file}`);
  }

  const payload = JSON.parse(fs.readFileSync(options.file, 'utf8'));
  const prisma = new PrismaClient();
  const reviewer = new QuestionReviewerService(new QuestionValidatorService(), new DisabledReviewerProvider());
  const qualityService = new QuestionQualityService(prisma);
  const adaptiveReplenishmentService = new AdaptiveReplenishmentService(prisma);
  const service = new AIQuestioningService(
    prisma,
    new QuestionGeneratorService(),
    new DisabledGeneratorProvider(),
    reviewer,
    new QuestionTopicMapperProviderService(disabledGateway()),
    qualityService,
    adaptiveReplenishmentService
  );

  try {
    const preview = await service.previewSyllabusJsonImport(payload);
    console.log(JSON.stringify({
      mode: options.apply ? 'apply' : 'preview',
      file: options.file,
      subject: preview.subject,
      syllabusVersion: preview.syllabusVersion,
      sourceLabel: preview.sourceLabel,
      summary: preview.summary,
      warnings: preview.warnings
    }, null, 2));

    if (!options.apply) {
      console.log('Dry run only. Re-run with --apply to create and apply this syllabus import.');
      return;
    }

    const created = await service.createSyllabusJsonImport(payload, options.actorId);
    const applied = await service.applySyllabusJsonImport(
      created.import.id,
      { missingTopicAction: options.missingTopicAction },
      options.actorId
    );
    console.log(JSON.stringify({
      appliedImportId: applied.import.id,
      subject: applied.import.subject,
      syllabusVersion: applied.import.syllabusVersion,
      missingTopicAction: options.missingTopicAction,
      result: applied.result
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
