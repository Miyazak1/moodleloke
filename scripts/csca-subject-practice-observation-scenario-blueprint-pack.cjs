#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSubjectPracticeObservationScenarioBlueprintIdeationPack,
  materializeSubjectPracticeObservationScenarioBlueprintResponsePack,
  subjectPracticeObservationScenarioBlueprintCostAdmissionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-pack-policy');
const {
  validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-execution-policy');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function readJson(filePath, label) {
  if (!filePath) throw new Error(`${label} file is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function manifestFrom(value) {
  return (Array.isArray(value?.tasks) ? value : null)
    ?? value?.manifest
    ?? value?.sealedObservationBatch?.manifest
    ?? value?.report?.sealedObservationBatch?.manifest
    ?? null;
}

function emit(value) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  const outPath = argValue('out');
  if (outPath) {
    const absolutePath = path.resolve(outPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, output, 'utf8');
    process.stdout.write(`${JSON.stringify({ status: 'written', path: absolutePath, bytes: Buffer.byteLength(output) }, null, 2)}\n`);
  } else {
    process.stdout.write(output);
  }
}

function main() {
  const mode = argValue('mode', 'requests').trim().toLowerCase();
  if (mode === 'requests') {
    const manifestInput = readJson(argValue('manifest'), 'Manifest');
    const manifest = manifestFrom(manifestInput);
    if (!manifest) throw new Error('Could not locate manifest in the supplied JSON file.');
    const historyPath = argValue('history');
    const history = historyPath ? readJson(historyPath, 'History') : {};
    const pack = buildSubjectPracticeObservationScenarioBlueprintIdeationPack({
      manifest,
      historySummaryByExactScope: history?.historySummaryByExactScope ?? history,
      candidatesPerExactScope: Number(argValue('candidates-per-scope', '4')),
      packInstanceId: argValue('pack-instance-id') || undefined
    });
    emit({
      ...pack,
      operatorNote: 'This file prepares prompts only. It does not authorize or call any provider.',
      responseFileSchema: {
        responses: [{ requestDigest: '<requestDigest from this pack>', rawResponse: '<provider JSON string>' }]
      }
    });
    return;
  }
  if (mode === 'materialize') {
    const manifestInput = readJson(argValue('manifest'), 'Manifest');
    const manifest = manifestFrom(manifestInput);
    if (!manifest) throw new Error('Could not locate manifest in the supplied JSON file.');
    const ideationPack = readJson(argValue('request-pack'), 'Request pack');
    const executionReceiptPath = argValue('execution-receipt');
    if (manifest.policyVersion === 'subject-practice-observation-batch-manifest-v11-campaign-bound'
      && !executionReceiptPath) {
      throw new Error('--execution-receipt is required for campaign-bound materialization.');
    }
    const executionReceipt = executionReceiptPath
      ? readJson(executionReceiptPath, 'Execution receipt')
      : null;
    const verifiedExecution = executionReceipt
      ? validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt({ ideationPack, executionReceipt })
      : null;
    if (verifiedExecution && verifiedExecution.status !== 'verified_for_materialization') {
      process.stdout.write(`${JSON.stringify(verifiedExecution, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const responseFile = executionReceipt
      ? null
      : readJson(argValue('responses'), 'Responses');
    const responses = verifiedExecution?.responses
      ?? (Array.isArray(responseFile) ? responseFile : responseFile.responses);
    const result = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
      manifest,
      ideationPack,
      responses
    });
    if (result.status !== 'materialized_addendum_shadow_only') {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    emit({
      ...result.addendum,
      creationEvidence: {
        packPolicyVersion: result.policyVersion,
        materializationPolicyVersion: result.materializationPolicyVersion,
        requestCount: result.requestCount,
        candidateBlueprintCount: result.candidateBlueprintCount,
        providerCallCountRecorded: result.providerCallCountRecorded,
        providerCallsPerQuestion: result.providerCallsPerQuestion,
        executionReceiptRequired: manifest.policyVersion === 'subject-practice-observation-batch-manifest-v11-campaign-bound',
        executionReceiptSha256: verifiedExecution?.executionReceiptSha256 ?? null,
        authorizationDigest: verifiedExecution?.authorizationDigest ?? null,
        actualCostUsd: verifiedExecution?.actualCostUsd ?? null,
        providerTransportAttemptCount: verifiedExecution?.providerTransportAttemptCount ?? null
      },
      operatorNote: 'Pass this file to the qualification preview with --scenario-blueprint-addendum. A fresh exact authorization is still required.'
    });
    return;
  }
  if (mode === 'cost') {
    const ideationPack = readJson(argValue('request-pack'), 'Request pack');
    const model = argValue(
      'model',
      process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-v4-flash'
    );
    const maximumCostUsdPerCall = Number(argValue('max-cost-usd-per-call', '0.0025'));
    const defaultTotal = Math.min(
      0.01,
      maximumCostUsdPerCall * Number(ideationPack.providerRequestCount || ideationPack.requestCount || 0)
    );
    const maximumTotalCostUsd = Number(argValue('max-total-cost-usd', String(defaultTotal)));
    const admission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
      ideationPack, model, maximumCostUsdPerCall, maximumTotalCostUsd
    });
    const exactAuthorizationText = admission.status === 'ready_for_exact_cost_authorization'
      ? `授权执行动态场景构思包 ${admission.requestPackSha256}，确认授权摘要 ${admission.authorizationDigest}，模型 ${admission.model}，最多 ${admission.maximumProviderCalls} 次串行请求，单次费用不超过 $${admission.maximumCostUsdPerCall}、总费用不超过 $${admission.maximumTotalCostUsd}；允许响应文件写入，禁止题库写入及学生端发布。`
      : null;
    emit({ ...admission, exactAuthorizationText });
    if (admission.status !== 'ready_for_exact_cost_authorization') process.exitCode = 1;
    return;
  }
  throw new Error('--mode must be requests, cost, or materialize.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}
