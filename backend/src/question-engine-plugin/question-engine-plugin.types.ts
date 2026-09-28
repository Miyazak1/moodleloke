export const QUESTION_ENGINE_PLUGIN_API_VERSION = '1' as const;

export type QuestionEngineCapability =
  | 'question.generate'
  | 'question.review'
  | 'question.topic-map';

export type QuestionEnginePluginDescriptor = {
  id: string;
  displayName: string;
  version: string;
  apiVersion: typeof QUESTION_ENGINE_PLUGIN_API_VERSION;
  capabilities: QuestionEngineCapability[];
  executionBoundary: 'in-process-adapter';
  activationMode: 'configuration-restart';
};

export type QuestionEngineCapabilityRuntimeStatus = {
  capability: QuestionEngineCapability;
  enabled: boolean;
  provider: string;
  model: string;
  providerConfigured: boolean;
  executionEnabled: boolean;
  status: 'disabled' | 'ready' | 'blocked';
  blockers: string[];
};

export type QuestionEnginePluginRuntimeStatus = {
  descriptor: QuestionEnginePluginDescriptor;
  selected: boolean;
  enabled: boolean;
  provider: string;
  model: string;
  providerConfigured: boolean;
  productionRunnerEnabled: boolean;
  generationWritesEnabled: boolean;
  status: 'disabled' | 'ready' | 'blocked';
  blockers: string[];
  capabilityStates: QuestionEngineCapabilityRuntimeStatus[];
};

export type QuestionEnginePluginRegistryStatus = {
  schemaVersion: '1';
  host: {
    apiVersion: typeof QUESTION_ENGINE_PLUGIN_API_VERSION;
    selectedPluginId: string;
    fallbackMode: 'verified-bank-only';
    fallbackAvailable: true;
    arbitraryRuntimeCodeLoading: false;
    enforcedCapabilities: QuestionEngineCapability[];
    taskProtocol: {
      version: 'question-engine-task-v1';
      executionMode: 'in-process' | 'sidecar';
      signingConfigured: boolean;
      sidecarEndpointConfigured: boolean;
      nonceStoreConfigured: boolean;
      transportImplemented: true;
      sidecarActivationSupported: true;
      sidecarActivationEnabled: boolean;
      workerCapabilities: QuestionEngineCapability[];
      acceptedWorkerVersions: string[];
    };
  };
  plugins: QuestionEnginePluginRuntimeStatus[];
  runtime?: QuestionEngineRuntimeObservability;
};

export type QuestionEngineWorkerRuntimeHealth = {
  status: 'not_applicable' | 'healthy' | 'blocked' | 'unreachable';
  checkedAt: string;
  latencyMs: number;
  protocol?: string;
  worker?: { id: string; version: string };
  capabilities?: QuestionEngineCapability[];
  blockers: string[];
};

export type QuestionEngineRuntimeObservability = {
  worker: QuestionEngineWorkerRuntimeHealth;
  transport: {
    circuit: { open: boolean; consecutiveFailures: number; threshold: number; resetMs: number };
    lastSuccessAt: string | null;
    lastFailure: { at: string; code: string; affectsCircuit: boolean } | null;
  };
};

export type QuestionEngineProductionReadiness = {
  status: 'inactive' | 'ready' | 'blocked';
  activationRequested: boolean;
  selectedPluginId: string;
  requiredCapabilities: QuestionEngineCapability[];
  blockers: string[];
  capabilityStates: QuestionEngineCapabilityRuntimeStatus[];
  runtime?: QuestionEngineRuntimeObservability;
};
