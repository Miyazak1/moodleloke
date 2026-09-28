import type { QuestionEnginePluginDescriptor, QuestionEnginePluginRuntimeStatus } from './question-engine-plugin.types';

export interface QuestionEnginePluginAdapter {
  describe(): QuestionEnginePluginDescriptor;
  runtimeStatus(input: { selectedPluginId: string; hostEnabled: boolean }): QuestionEnginePluginRuntimeStatus;
}
