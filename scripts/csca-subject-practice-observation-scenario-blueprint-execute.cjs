#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
}

// Standalone CLIs do not pass through Nest's environment bootstrap. Load the
// repository environment before importing gateway modules that read process.env.
loadEnvFile(path.resolve(__dirname, '../.env'));

const { createStandaloneAiGatewayService } = require('../backend/src/ai-gateway/ai-gateway.service');
const { AiGatewayConfigService } = require('../backend/src/ai-gateway/ai-gateway-config.service');
const {
  subjectPracticeObservationScenarioBlueprintCostAdmissionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-pack-policy');
const {
  executeSubjectPracticeObservationScenarioBlueprintPack
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-execution-policy');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function readJson(filePath, label) {
  if (!filePath) throw new Error(`${label} file is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeNewJson(filePath, value) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return absolutePath;
}

async function providerNetworkPreflightFor(baseUrl, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(`${String(baseUrl).replace(/\/+$/, '')}/`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal
    });
    return { reachable: true, httpStatus: Number(response.status) || null };
  } catch (error) {
    return {
      reachable: false,
      errorCode: String(error?.cause?.code || error?.code || error?.name || 'network_error')
    };
  } finally {
    clearTimeout(timeout);
  }
}

function authorizationConsumptionPreflightFor(receiptDirectory, authorizationDigest, existsImpl = fs.existsSync) {
  const receiptPath = path.join(path.resolve(receiptDirectory), `${authorizationDigest}.json`);
  const alreadyConsumed = existsImpl(receiptPath);
  return { receiptPath, alreadyConsumed, ready: !alreadyConsumed };
}

function executionPreflightFor(input) {
  const blockers = [
    ...(!input.admissionReady ? ['cost_admission_not_ready'] : []),
    ...(!input.environmentReady ? ['provider_environment_not_ready'] : []),
    ...(!input.authorizationReady ? ['authorization_already_consumed'] : []),
    ...(!input.outputProvided ? ['response_output_path_required'] : []),
    ...(input.outputProvided && !input.outputReady ? ['response_output_already_exists'] : [])
  ];
  return { ready: blockers.length === 0, blockers };
}

async function main() {
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
    ? `授权执行动态场景构思包 ${admission.requestPackSha256}，确认授权摘要 ${admission.authorizationDigest}，模型 ${admission.model}，采样温度 ${admission.samplingTemperature}，最多 ${admission.maximumProviderCalls} 次串行请求，单次费用不超过 $${admission.maximumCostUsdPerCall}、总费用不超过 $${admission.maximumTotalCostUsd}；允许一次性本地响应及执行回执写入，禁止观察任务、候选题及学生端发布。`
    : null;
  const gatewayConfig = new AiGatewayConfigService();
  const configuredKeys = gatewayConfig.platformKeysForTask('question_generation', model);
  const environmentPreflight = {
    gatewayEnabled: gatewayConfig.isEnabled(),
    configuredKeyCount: configuredKeys.length,
    enabledKeyCount: configuredKeys.filter((key) => key.enabled).length,
    model,
    baseUrl: gatewayConfig.baseUrlForTask('question_generation'),
    ready: gatewayConfig.isEnabled() && configuredKeys.some((key) => key.enabled)
  };
  const receiptDirectory = path.resolve(__dirname, '../artifacts/ai-questioning/scenario-blueprint-executions');
  const authorizationConsumptionPreflight = authorizationConsumptionPreflightFor(
    receiptDirectory, admission.authorizationDigest
  );
  const requestedOutputPath = argValue('out');
  const outputPreflight = {
    path: requestedOutputPath ? path.resolve(requestedOutputPath) : null,
    provided: Boolean(requestedOutputPath),
    alreadyExists: requestedOutputPath ? fs.existsSync(path.resolve(requestedOutputPath)) : false,
    ready: Boolean(requestedOutputPath) && !fs.existsSync(path.resolve(requestedOutputPath))
  };
  const executionPreflight = executionPreflightFor({
    admissionReady: admission.status === 'ready_for_exact_cost_authorization',
    environmentReady: environmentPreflight.ready,
    authorizationReady: authorizationConsumptionPreflight.ready,
    outputProvided: outputPreflight.provided,
    outputReady: outputPreflight.ready
  });
  if (!hasFlag('apply')) {
    process.stdout.write(`${JSON.stringify({
      mode: 'scenario_blueprint_execution_preview', ...admission, exactAuthorizationText,
      environmentPreflight, authorizationConsumptionPreflight, outputPreflight,
      executionPreflight, executionPreflightReady: executionPreflight.ready,
      executionStarted: false, providerCallCount: 0, actualCostUsd: 0
    }, null, 2)}\n`);
    if (admission.status !== 'ready_for_exact_cost_authorization') process.exitCode = 1;
    return;
  }

  const outputPath = argValue('out');
  if (!outputPath) throw new Error('--out is required for --apply execution.');
  const authorizationDigest = argValue('authorization-digest');
  if (admission.status !== 'ready_for_exact_cost_authorization') {
    throw new Error(`cost_admission_not_ready:${admission.blockers.join(',')}`);
  }
  if (authorizationDigest !== admission.authorizationDigest) {
    throw new Error('authorization_digest_mismatch');
  }
  if (!environmentPreflight.ready) {
    throw new Error('execution_environment_no_enabled_provider_key');
  }
  if (!authorizationConsumptionPreflight.ready) {
    throw new Error(`authorization_digest_already_consumed:${admission.authorizationDigest}`);
  }
  if (!outputPreflight.ready) {
    throw new Error(`response_output_already_exists:${outputPreflight.path}`);
  }
  const networkPreflight = await providerNetworkPreflightFor(environmentPreflight.baseUrl);
  if (!networkPreflight.reachable) {
    throw new Error(`execution_environment_provider_network_unreachable:${networkPreflight.errorCode}`);
  }
  const consumptionPath = path.join(receiptDirectory, `${admission.authorizationDigest}.json`);
  fs.mkdirSync(receiptDirectory, { recursive: true });
  let consumptionHandle;
  try {
    consumptionHandle = fs.openSync(consumptionPath, 'wx');
    fs.writeFileSync(consumptionHandle, `${JSON.stringify({
      status: 'authorization_consumed_execution_started',
      authorizationDigest: admission.authorizationDigest,
      requestPackSha256: admission.requestPackSha256,
      startedAt: new Date().toISOString()
    }, null, 2)}\n`, 'utf8');
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`authorization_digest_already_consumed:${admission.authorizationDigest}`);
    }
    throw error;
  } finally {
    if (consumptionHandle != null) fs.closeSync(consumptionHandle);
  }

  const gateway = createStandaloneAiGatewayService();
  let receipt;
  try {
    receipt = await executeSubjectPracticeObservationScenarioBlueprintPack({
      ideationPack,
      costAdmission: admission,
      authorizationDigest,
      apply: true,
      complete: (request) => gateway.complete(request)
    });
  } catch (error) {
    receipt = {
      status: 'stopped_on_unhandled_execution_error',
      authorizationDigest: admission.authorizationDigest,
      requestPackSha256: admission.requestPackSha256,
      errorCode: error instanceof Error ? error.message : String(error),
      publicationAuthorized: false
    };
  }
  fs.writeFileSync(consumptionPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  const absoluteOutputPath = writeNewJson(outputPath, receipt);
  process.stdout.write(`${JSON.stringify({
    status: receipt.status,
    executionReceiptSha256: receipt.executionReceiptSha256 ?? null,
    responseFile: absoluteOutputPath,
    authorizationConsumptionReceipt: consumptionPath,
    gatewayRequestCount: receipt.gatewayRequestCount ?? 0,
    providerTransportAttemptCount: receipt.providerTransportAttemptCount ?? 0,
    actualCostUsd: receipt.actualCostUsd ?? null,
    completedResponseCount: receipt.completedResponseCount ?? 0,
    publicationAuthorized: false
  }, null, 2)}\n`);
  if (receipt.status !== 'completed_response_pack_ready_for_materialization') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  authorizationConsumptionPreflightFor,
  executionPreflightFor,
  providerNetworkPreflightFor
};
