import { Injectable } from '@nestjs/common';
import type { QuestionEngineCapability, QuestionEnginePluginRegistryStatus, QuestionEngineProductionReadiness } from './question-engine-plugin.types';
import { VerifiedMath143Adapter, VERIFIED_MATH_PLUGIN_ID, type MathGenerationOutput } from './verified-math143.adapter';

/** Only completed, locally verified engines may be registered here. */
@Injectable()
export class QuestionEnginePluginRegistryService {
  constructor(private readonly math: VerifiedMath143Adapter) {}
  private selected() { return String(process.env.QUESTION_ENGINE_PLUGIN_ID ?? VERIFIED_MATH_PLUGIN_ID).trim(); }
  private hostEnabled() { return process.env.QUESTION_ENGINE_PLUGIN_ENABLED === 'true' || process.env.QUESTION_ENGINE_PLUGIN_ENABLED === '1'; }
  getStatus(): QuestionEnginePluginRegistryStatus {
    return { schemaVersion: '1', host: {
      apiVersion: '1', selectedPluginId: this.selected(), fallbackMode: 'verified-bank-only', fallbackAvailable: true,
      arbitraryRuntimeCodeLoading: false, enforcedCapabilities: ['question.generate'],
      taskProtocol: { version: 'question-engine-task-v1', executionMode: 'in-process', signingConfigured: false,
        sidecarEndpointConfigured: false, nonceStoreConfigured: false, transportImplemented: true,
        sidecarActivationSupported: false, sidecarActivationEnabled: false, workerCapabilities: ['question.generate'], acceptedWorkerVersions: ['1.43.0'] }
    }, plugins: [this.math.runtimeStatus({ selectedPluginId: this.selected(), hostEnabled: this.hostEnabled() })] };
  }
  async getStatusWithRuntime(_force = false) { return this.getStatus(); }
  // Legacy Provider/sidecar entrypoints are retired, even when old env flags remain set.
  usesSidecar() { return false; }
  allowsProductionCapability(_capability: QuestionEngineCapability) { return false; }
  async executeSidecarCapability<T>(_capability: QuestionEngineCapability, _payload: unknown): Promise<T> { throw Error('legacy_question_engine_retired'); }
  isVerifiedMathEnabled() { return this.getStatus().plugins[0].generationWritesEnabled; }
  mathCatalog() { this.assertMathEnabled(); return this.math.catalog(); }
  async generateVerifiedMath(input: { cellId: string; scopeId: string; seed: number }) { this.assertMathEnabled(); return this.math.generate(input); }
  assertVerifiedMath(output: MathGenerationOutput) { this.assertMathEnabled(); this.math.assertVerified(output); }
  private assertMathEnabled() { if (!this.isVerifiedMathEnabled()) throw Error('verified_math_plugin_not_ready'); }
  getProductionReadiness(): QuestionEngineProductionReadiness {
    const state = this.getStatus().plugins[0];
    const requested = this.hostEnabled() || process.env.MOODLELIKE_MATH_ENGINE_ENABLED === 'true';
    return { status: !requested ? 'inactive' : state.generationWritesEnabled ? 'ready' : 'blocked', activationRequested: requested,
      selectedPluginId: this.selected(), requiredCapabilities: requested ? ['question.generate'] : [], blockers: requested ? state.blockers : [], capabilityStates: state.capabilityStates };
  }
  async getProductionReadinessWithRuntime(_force = false) { return this.getProductionReadiness(); }
}
