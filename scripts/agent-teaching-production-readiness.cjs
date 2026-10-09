#!/usr/bin/env node

const path = require('node:path');
const fs = require('node:fs');
const { loadEnv } = require('./load-env.cjs');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = { json: false, strict: false, minimumQuestions: 12, expectedStage: 'auto' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--minimum-questions') options.minimumQuestions = Number(argv[++index]);
    else if (arg === '--expect-stage') options.expectedStage = String(argv[++index] || '').trim().toLowerCase();
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.minimumQuestions) || options.minimumQuestions < 9) {
    throw new Error('--minimum-questions must be an integer of at least 9.');
  }
  if (!['auto', 'shadow', 'canary'].includes(options.expectedStage)) {
    throw new Error('--expect-stage must be one of: auto, shadow, canary.');
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-teaching-production-readiness.cjs [options]

Read-only production gate for the first mathematics teaching vertical slice.

Options:
  --json                    Print JSON only.
  --strict                  Exit non-zero when the slice is not ready.
  --minimum-questions <n>   Required eligible fresh questions per topic (default: 12).
  --expect-stage <stage>    Validate auto, shadow, or canary rollout configuration (default: auto).
  -h, --help                Show this help.`);
}

function enabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function routingMode(value) {
  const normalized = String(value ?? 'legacy').trim().toLowerCase();
  return normalized === 'shadow' || normalized === 'active' ? normalized : 'legacy';
}

function rolloutPercent(value) {
  const raw = String(value ?? '0').trim();
  const parsed = Number(raw);
  return {
    raw,
    valid: raw !== '' && Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100,
    value: Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.floor(parsed))) : 0
  };
}

function activeSubjects(value) {
  return [...new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean))];
}

function evaluateRolloutConfiguration(env, expectedStage = 'auto') {
  const mode = routingMode(env.CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE);
  const subjects = activeSubjects(env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS);
  const percent = rolloutPercent(env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT);
  const delivery = enabled(env.CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED);
  const verification = enabled(env.CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED);
  const inferredStage = mode === 'active' ? 'canary' : 'shadow';
  const stage = expectedStage === 'auto' ? inferredStage : expectedStage;
  const blockers = [];

  if (!percent.valid) blockers.push('ROLLOUT_PERCENT_INVALID');
  if (verification && !delivery) blockers.push('VERIFICATION_REQUIRES_DELIVERY');

  if (stage === 'shadow') {
    if (mode !== 'shadow') blockers.push('SHADOW_REQUIRES_SHADOW_ROUTING');
    if (delivery) blockers.push('SHADOW_REQUIRES_DELIVERY_DISABLED');
    if (verification) blockers.push('SHADOW_REQUIRES_VERIFICATION_DISABLED');
    if (subjects.length) blockers.push('SHADOW_REQUIRES_NO_ACTIVE_SUBJECTS');
    if (percent.value !== 0) blockers.push('SHADOW_REQUIRES_ZERO_PERCENT');
  } else {
    if (mode !== 'active') blockers.push('CANARY_REQUIRES_ACTIVE_ROUTING');
    if (!delivery) blockers.push('CANARY_REQUIRES_DELIVERY_ENABLED');
    if (!verification) blockers.push('CANARY_REQUIRES_VERIFICATION_ENABLED');
    if (subjects.length !== 1 || subjects[0] !== 'math') blockers.push('CANARY_SCOPE_MUST_BE_MATH_ONLY');
    if (percent.value < 1 || percent.value > 5) blockers.push('CANARY_PERCENT_MUST_BE_1_TO_5');
  }

  return { stage, inferredStage, mode, subjects, percent: percent.value, percentRaw: percent.raw, delivery, verification, blockers };
}

function questionRef(item) {
  return `csca_question:${item.questionId}:v${item.questionVersion}`;
}

const TARGETS = [
  {
    topicCode: 'M-FUNC-001',
    label: '函数的概念与性质',
    componentKey: 'visualizer.math.function-transform'
  }
];

async function inspectTarget(prisma, questionProvider, target, minimumQuestions) {
  const topic = await prisma.cscaExamTopic.findUnique({
    where: { code: target.topicCode },
    select: { id: true, code: true, title: true, status: true, syllabusVersion: true }
  });
  if (!topic) {
    return {
      ...target,
      status: 'blocked',
      blockers: ['TOPIC_MISSING'],
      topic: null,
      asset: null,
      supply: { practiceEligible: 0, verificationEligible: 0, immediate: 0, retention: 0, transfer: 0 }
    };
  }

  const asset = await prisma.teachingAsset.findFirst({
    where: {
      stableKey: target.componentKey,
      subjectCode: 'math',
      topics: { some: { topicId: topic.id, relationship: 'primary' } }
    },
    select: {
      id: true,
      stableKey: true,
      status: true,
      versions: {
        where: { status: 'published', language: 'zh-CN' },
        orderBy: [{ version: 'desc' }],
        take: 1,
        select: { id: true, version: true, status: true, reviewState: true, componentKey: true }
      }
    }
  });

  // Use the same domain selector as the real verification workflow. A
  // negative synthetic user has no exposure rows and therefore measures the
  // maximum currently eligible production supply without mutating data.
  const syntheticUserId = -1;
  const practice = await questionProvider.pickQuestions(syntheticUserId, [{
    topicId: topic.id,
    code: topic.code,
    title: topic.title,
    module: null,
    targetDifficulty: '中等',
    reason: 'production_readiness'
  }], minimumQuestions);
  const verificationEligible = await questionProvider.pickIndependentVerificationQuestions(
    syntheticUserId,
    topic.id,
    minimumQuestions
  );
  const immediate = await questionProvider.pickIndependentVerificationQuestions(syntheticUserId, topic.id, 3);
  const immediateRefs = immediate.map(questionRef);
  const retention = await questionProvider.pickIndependentVerificationQuestions(
    syntheticUserId,
    topic.id,
    3,
    immediateRefs
  );
  const prior = [...immediate, ...retention];
  const transfer = await questionProvider.pickIndependentVerificationQuestions(
    syntheticUserId,
    topic.id,
    3,
    prior.map(questionRef),
    {
      requireDifferentTransferSignature: true,
      excludedTransferSignatures: [...new Set(prior.map((item) => item.transferSignature).filter(Boolean))]
    }
  );

  const blockers = [];
  if (topic.status !== 'published') blockers.push('TOPIC_NOT_PUBLISHED');
  if (!asset || asset.status !== 'published' || !asset.versions.length) blockers.push('PUBLISHED_ASSET_MISSING');
  if (asset?.versions[0]?.componentKey !== target.componentKey) blockers.push('ASSET_COMPONENT_MISMATCH');
  if (practice.length < minimumQuestions) blockers.push('PRACTICE_CAPACITY_BELOW_TARGET');
  if (verificationEligible.length < minimumQuestions) blockers.push('VERIFICATION_CAPACITY_BELOW_TARGET');
  if (immediate.length < 3) blockers.push('IMMEDIATE_VERIFICATION_SUPPLY_MISSING');
  if (retention.length < 3) blockers.push('RETENTION_VERIFICATION_SUPPLY_MISSING');
  if (transfer.length < 3) blockers.push('TRANSFER_VERIFICATION_DIVERSITY_MISSING');

  return {
    ...target,
    status: blockers.length ? 'blocked' : 'ready',
    blockers,
    topic,
    asset: asset ? {
      stableKey: asset.stableKey,
      status: asset.status,
      publishedVersion: asset.versions[0] ?? null
    } : null,
    supply: {
      practiceEligible: practice.length,
      verificationEligible: verificationEligible.length,
      required: minimumQuestions,
      immediate: immediate.length,
      retention: retention.length,
      transfer: transfer.length,
      transferSignatures: [...new Set(transfer.map((item) => item.transferSignature).filter(Boolean))]
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadEnv(ROOT);
  if (!String(process.env.DATABASE_URL || '').trim()) {
    const report = {
      schemaVersion: '1',
      checkedAt: new Date().toISOString(),
      slice: 'math-functions-teaching-v1',
      status: 'unavailable',
      blockers: ['DATABASE_URL_MISSING'],
      message: 'Set DATABASE_URL to run the read-only production readiness check.'
    };
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else console.error(`Math functions teaching slice: ${report.status}\nBLOCK runtime: DATABASE_URL_MISSING`);
    process.exitCode = 1;
    return;
  }
  const { PrismaClient } = require('../backend/node_modules/@prisma/client');
  const compiledProviderPath = path.join(
    ROOT,
    'backend',
    'dist',
    'backend',
    'src',
    'csca-special-practice',
    'adaptive-question-provider.service.js'
  );
  let providerModule;
  if (fs.existsSync(compiledProviderPath)) {
    providerModule = require(compiledProviderPath);
  } else {
    require('../backend/node_modules/ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
        moduleResolution: 'node',
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    });
    providerModule = require('../backend/src/csca-special-practice/adaptive-question-provider.service');
  }
  const { AdaptiveQuestionProviderService } = providerModule;

  const prisma = new PrismaClient();
  try {
    const questionProvider = new AdaptiveQuestionProviderService(prisma);
    const targets = [];
    for (const target of TARGETS) {
      targets.push(await inspectTarget(prisma, questionProvider, target, options.minimumQuestions));
    }

    const featureFlags = {
      foundation: enabled(process.env.CSCA_AGENT_FOUNDATION_ENABLED),
      evidenceWrite: enabled(process.env.CSCA_LEARNING_EVIDENCE_WRITE_ENABLED),
      shadowProjection: enabled(process.env.CSCA_LEARNING_SHADOW_PROJECTION_ENABLED),
      targetGap: enabled(process.env.CSCA_TARGET_GAP_ENABLED),
      prescription: enabled(process.env.CSCA_LEARNING_PRESCRIPTION_ENABLED),
      interventionShadow: enabled(process.env.CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED),
      interventionDelivery: enabled(process.env.CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED),
      interventionVerification: enabled(process.env.CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED),
      teachingAsset: enabled(process.env.CSCA_AGENT_TEACHING_ASSET_ENABLED),
      teachingRoutingMode: routingMode(process.env.CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE),
      teachingRoutingActiveSubjects: activeSubjects(process.env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS),
      teachingRoutingActivePercent: rolloutPercent(process.env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT).value
    };
    const flagBlockers = [];
    for (const key of ['foundation', 'evidenceWrite', 'shadowProjection', 'targetGap', 'prescription', 'interventionShadow', 'teachingAsset']) {
      if (!featureFlags[key]) flagBlockers.push(`FEATURE_${key.toUpperCase()}_DISABLED`);
    }
    if (featureFlags.teachingRoutingMode === 'legacy') flagBlockers.push('TEACHING_ROUTING_NOT_IN_SHADOW');
    const rollout = evaluateRolloutConfiguration(process.env, options.expectedStage);

    const blockers = [
      ...flagBlockers,
      ...rollout.blockers,
      ...targets.flatMap((target) => target.blockers.map((blocker) => `${target.topicCode}:${blocker}`))
    ];
    const report = {
      schemaVersion: '1',
      checkedAt: new Date().toISOString(),
      slice: 'math-functions-teaching-v1',
      status: blockers.length ? 'blocked' : `ready_for_${rollout.stage}`,
      blockers,
      featureFlags,
      rollout,
      targets
    };

    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Math functions teaching slice: ${report.status}`);
      console.log(`Feature mode: intervention=${featureFlags.interventionShadow ? 'shadow' : 'off'}, delivery=${featureFlags.interventionDelivery}, verification=${featureFlags.interventionVerification}, routing=${featureFlags.teachingRoutingMode}, subjects=${rollout.subjects.join(',') || '-'}, percent=${rollout.percent}`);
      for (const target of targets) {
        console.log(`${target.status === 'ready' ? 'PASS' : 'BLOCK'} ${target.topicCode} ${target.label}: asset=${target.asset?.status ?? 'missing'}, practice=${target.supply.practiceEligible}/${target.supply.required}, verification=${target.supply.verificationEligible}/${target.supply.required}, phases=${target.supply.immediate}/${target.supply.retention}/${target.supply.transfer}`);
        for (const blocker of target.blockers) console.log(`  - ${blocker}`);
      }
      for (const blocker of flagBlockers) console.log(`BLOCK feature: ${blocker}`);
      for (const blocker of rollout.blockers) console.log(`BLOCK rollout: ${blocker}`);
    }
    if (options.strict && blockers.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = { activeSubjects, evaluateRolloutConfiguration, parseArgs, rolloutPercent, routingMode };
