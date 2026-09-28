import { Injectable, Optional } from '@nestjs/common';
import { BuiltinAIQuestioningAdapter } from './builtin-ai-questioning.adapter';
import type { QuestionEnginePluginAdapter } from './question-engine-plugin.contract';
import {
  QUESTION_ENGINE_PLUGIN_API_VERSION,
  type QuestionEngineCapability,
  type QuestionEnginePluginRegistryStatus,
  type QuestionEngineProductionReadiness
} from './question-engine-plugin.types';
import { QUESTION_ENGINE_TASK_PROTOCOL_VERSION, questionEngineTaskSigningConfigured } from './question-engine-task-protocol';
import { questionEngineNonceStoreConfigured } from './question-engine-nonce-store.service';
import {
  acceptedQuestionEngineWorkerVersions,
  QuestionEngineSidecarTransportService
} from './question-engine-sidecar-transport.service';
import { QuestionEngineWorkerHealthService } from './question-engine-worker-health.service';

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

@Injectable()
export class QuestionEnginePluginRegistryService {
  private readonly adapters: QuestionEnginePluginAdapter[];

  constructor(
    builtinAdapter: BuiltinAIQuestioningAdapter,
    @Optional() private readonly sidecarTransport?: QuestionEngineSidecarTransportService,
    @Optional() private readonly workerHealth?: QuestionEngineWorkerHealthService
  ) {
    this.adapters = [builtinAdapter];
  }

  usesSidecar() {
    return process.env.QUESTION_ENGINE_EXECUTION_MODE === 'sidecar';
  }

  async executeSidecarCapability<T>(capability: QuestionEngineCapability, payload: unknown): Promise<T> {
    if (!this.usesSidecar()) throw new Error('question_engine_sidecar_mode_not_enabled');
    if (!this.sidecarTransport) throw new Error('question_engine_sidecar_transport_unavailable');
    const status = this.getStatus();
    const selected = status.plugins.find((plugin) => plugin.selected);
    if (!selected || !selected.descriptor.capabilities.includes(capability)) {
      throw new Error('question_engine_sidecar_capability_not_registered');
    }
    return this.sidecarTransport.execute<T>({ capability, plugin: selected.descriptor, payload });
  }

  getStatus(): QuestionEnginePluginRegistryStatus {
    const selectedPluginId = String(process.env.QUESTION_ENGINE_PLUGIN_ID ?? 'moodlelike-ai-questioning').trim();
    const hostEnabled = enabled(process.env.QUESTION_ENGINE_PLUGIN_ENABLED);
    const executionMode = process.env.QUESTION_ENGINE_EXECUTION_MODE === 'sidecar' ? 'sidecar' : 'in-process';
    const workerCapabilities = String(process.env.QUESTION_ENGINE_WORKER_CAPABILITIES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is QuestionEngineCapability => (
        ['question.generate', 'question.review', 'question.topic-map'] as string[]
      ).includes(value));
    return {
      schemaVersion: '1',
      host: {
        apiVersion: QUESTION_ENGINE_PLUGIN_API_VERSION,
        selectedPluginId,
        fallbackMode: 'verified-bank-only',
        fallbackAvailable: true,
        arbitraryRuntimeCodeLoading: false,
        enforcedCapabilities: ['question.generate', 'question.review', 'question.topic-map'],
        taskProtocol: {
          version: QUESTION_ENGINE_TASK_PROTOCOL_VERSION,
          executionMode,
          signingConfigured: questionEngineTaskSigningConfigured(),
          sidecarEndpointConfigured: Boolean(String(process.env.QUESTION_ENGINE_SIDECAR_URL ?? '').trim()),
          nonceStoreConfigured: questionEngineNonceStoreConfigured(),
          transportImplemented: true,
          sidecarActivationSupported: true,
          sidecarActivationEnabled: enabled(process.env.QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED),
          workerCapabilities: [...new Set(workerCapabilities)],
          acceptedWorkerVersions: acceptedQuestionEngineWorkerVersions()
        }
      },
      plugins: this.adapters.map((adapter) => adapter.runtimeStatus({ selectedPluginId, hostEnabled }))
    };
  }

  async getStatusWithRuntime(force = false): Promise<QuestionEnginePluginRegistryStatus> {
    const status = this.getStatus();
    const worker = this.workerHealth
      ? await this.workerHealth.inspect(force)
      : { status: 'not_applicable' as const, checkedAt: new Date().toISOString(), latencyMs: 0, blockers: [] };
    return {
      ...status,
      runtime: {
        worker,
        transport: this.sidecarTransport?.getOperationalStatus() ?? {
          circuit: { open: false, consecutiveFailures: 0, threshold: 0, resetMs: 0 },
          lastSuccessAt: null,
          lastFailure: null
        }
      }
    };
  }

  allowsProductionCapability(capability: QuestionEngineCapability) {
    const status = this.getStatus();
    const selected = status.plugins.find((plugin) => plugin.selected);
    if (!selected || !selected.descriptor.capabilities.includes(capability)) return false;
    const capabilityReady = selected.capabilityStates.find((item) => item.capability === capability)?.executionEnabled === true;
    if (!capabilityReady) return false;
    if (status.host.taskProtocol.executionMode !== 'sidecar') return true;
    return status.host.taskProtocol.signingConfigured
      && status.host.taskProtocol.sidecarEndpointConfigured
      && status.host.taskProtocol.nonceStoreConfigured
      && status.host.taskProtocol.sidecarActivationEnabled
      && status.host.taskProtocol.acceptedWorkerVersions.length > 0
      && status.host.taskProtocol.workerCapabilities.includes(capability);
  }

  getProductionReadiness(): QuestionEngineProductionReadiness {
    const status = this.getStatus();
    const selected = status.plugins.find((plugin) => plugin.selected);
    const generationRequested = enabled(process.env.CSCA_AI_QUESTION_GENERATION_ENABLED)
      || enabled(process.env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED)
      || enabled(process.env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED);
    const reviewRequested = enabled(process.env.CSCA_AI_QUESTION_REVIEW_ENABLED);
    const topicRequested = process.env.CSCA_AI_TOPIC_MAPPING_ENABLED === undefined
      ? generationRequested || reviewRequested
      : enabled(process.env.CSCA_AI_TOPIC_MAPPING_ENABLED);
    const requiredCapabilities = [
      generationRequested ? 'question.generate' : null,
      reviewRequested ? 'question.review' : null,
      topicRequested ? 'question.topic-map' : null
    ].filter((capability): capability is QuestionEngineCapability => Boolean(capability));
    const activationRequested = enabled(process.env.QUESTION_ENGINE_PLUGIN_ENABLED) || requiredCapabilities.length > 0;
    if (!activationRequested) {
      return {
        status: 'inactive', activationRequested, selectedPluginId: status.host.selectedPluginId,
        requiredCapabilities, blockers: [], capabilityStates: []
      };
    }
    const capabilityStates = requiredCapabilities
      .map((capability) => selected?.capabilityStates.find((item) => item.capability === capability))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const blockers = [
      !enabled(process.env.QUESTION_ENGINE_PLUGIN_ENABLED) ? 'plugin_host_disabled' : null,
      !selected ? 'selected_plugin_not_registered' : null,
      requiredCapabilities.length === 0 ? 'no_capability_enabled' : null,
      status.host.taskProtocol.executionMode === 'sidecar' && !status.host.taskProtocol.signingConfigured ? 'task_protocol_signing_not_configured' : null,
      status.host.taskProtocol.executionMode === 'sidecar' && !status.host.taskProtocol.sidecarEndpointConfigured ? 'sidecar_endpoint_not_configured' : null,
      status.host.taskProtocol.executionMode === 'sidecar' && !status.host.taskProtocol.nonceStoreConfigured ? 'nonce_store_not_configured' : null,
      status.host.taskProtocol.executionMode === 'sidecar' && !status.host.taskProtocol.sidecarActivationEnabled ? 'sidecar_activation_not_enabled' : null,
      status.host.taskProtocol.executionMode === 'sidecar' && !status.host.taskProtocol.acceptedWorkerVersions.length ? 'worker_version_policy_not_configured' : null,
      ...requiredCapabilities.flatMap((capability) => status.host.taskProtocol.executionMode === 'sidecar'
        && !status.host.taskProtocol.workerCapabilities.includes(capability)
        ? [`${capability}:worker_capability_not_configured`]
        : []),
      ...requiredCapabilities.flatMap((capability) => {
        const capabilityStatus = selected?.capabilityStates.find((item) => item.capability === capability);
        if (!capabilityStatus) return [`${capability}:capability_not_registered`];
        return capabilityStatus.executionEnabled
          ? []
          : capabilityStatus.blockers.map((blocker) => `${capability}:${blocker}`);
      })
    ].filter((blocker): blocker is string => Boolean(blocker));
    return {
      status: blockers.length ? 'blocked' : 'ready',
      activationRequested,
      selectedPluginId: status.host.selectedPluginId,
      requiredCapabilities,
      blockers: [...new Set(blockers)],
      capabilityStates
    };
  }

  async getProductionReadinessWithRuntime(force = false): Promise<QuestionEngineProductionReadiness> {
    const readiness = this.getProductionReadiness();
    const status = await this.getStatusWithRuntime(force);
    const runtime = status.runtime;
    if (!runtime || status.host.taskProtocol.executionMode !== 'sidecar'
      || !status.host.taskProtocol.sidecarActivationEnabled) return { ...readiness, runtime };
    const runtimeBlockers = [
      runtime.worker.status !== 'healthy' ? 'sidecar_worker_runtime_not_ready' : null,
      runtime.transport.circuit.open ? 'sidecar_transport_circuit_open' : null,
      ...runtime.worker.blockers.map((blocker) => `sidecar_worker:${blocker}`)
    ].filter((blocker): blocker is string => Boolean(blocker));
    return {
      ...readiness,
      status: readiness.status === 'inactive' ? 'inactive' : runtimeBlockers.length ? 'blocked' : readiness.status,
      blockers: [...new Set([...readiness.blockers, ...runtimeBlockers])],
      runtime
    };
  }
}
