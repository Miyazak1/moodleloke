import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QuestionEnginePluginAdapter } from './question-engine-plugin.contract';
import type { QuestionEnginePluginDescriptor, QuestionEnginePluginRuntimeStatus } from './question-engine-plugin.types';

export const VERIFIED_MATH_PLUGIN_ID = 'verified-math-1.43';
export type MathDifficulty = 'basic' | 'medium' | 'hard';
export type MathCell = { id: string; topicCode: string; difficulty: MathDifficulty; scopes: Array<{ id: string; capacity: number; samplingMode?: 'finite-stock-index' | 'parameter-seed' }> };
export type MathGenerationOutput = {
  applicationVersion: string; providerCalls: number; costUsd: number;
  task: { cellId: string; scopeId: string; seed: number; runtimeBundleHash: string };
  result: {
    passed: boolean; contentHash: string; fingerprint: string;
    candidate: { subject: string; topicId: number; prompt: string; options: Array<{ id: string; text: string }>; correctAnswer: string; explanation: string; knowledgeTags: string[]; optionMetadata?: unknown; localizations: unknown; questionType: string };
    gate: { passed: boolean; checks: Record<string, boolean>; review?: unknown };
    admission: { status: string; studentCalibrated: boolean };
    questionArtifact: { scopeId: string; cellId: string; identity: { identityHash: string }; hash: string };
    generationSource: unknown; pedagogy?: unknown; plan: unknown;
  };
};
type Runtime = { status(): { installed: boolean }; catalog(): { cells: MathCell[] }; generateVerifiedQuestion(input: { cellId: string; scopeId: string; seed: number }): Promise<MathGenerationOutput> };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class VerifiedMath143Adapter implements QuestionEnginePluginAdapter {
  private readonly evidence = new WeakMap<MathGenerationOutput, string>();
  describe(): QuestionEnginePluginDescriptor {
    return { id: VERIFIED_MATH_PLUGIN_ID, displayName: '数学 1.43 已核验出题引擎', version: '1.43.0', apiVersion: '1',
      capabilities: ['question.generate'], subjects: ['math'], executionBoundary: 'isolated-worker', activationMode: 'configuration-restart' };
  }
  private runtime(): Runtime {
    let directory = __dirname;
    while (true) {
      const file = path.join(directory, 'question-engine/math-v143/runtime.cjs');
      if (fs.existsSync(file)) return require(file) as Runtime;
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error('verified_math_runtime_not_installed');
      directory = parent;
    }
  }
  catalog() { return this.runtime().catalog(); }
  runtimeStatus({ selectedPluginId, hostEnabled }: { selectedPluginId: string; hostEnabled: boolean }): QuestionEnginePluginRuntimeStatus {
    const selected = selectedPluginId === VERIFIED_MATH_PLUGIN_ID;
    let installed = false;
    try { installed = this.runtime().status().installed === true; } catch { /* fail closed */ }
    const configured = process.env.MOODLELIKE_MATH_ENGINE_ENABLED === 'true';
    const blockers = [!selected ? 'plugin_not_selected' : '', !hostEnabled ? 'plugin_host_disabled' : '', !configured ? 'verified_math_disabled' : '', !installed ? 'frozen_runtime_integrity_required' : ''].filter(Boolean);
    const ready = blockers.length === 0;
    return { descriptor: this.describe(), selected, enabled: selected && hostEnabled, provider: 'local-deterministic', model: '',
      providerConfigured: installed, productionRunnerEnabled: configured, generationWritesEnabled: ready,
      status: !selected || !hostEnabled ? 'disabled' : ready ? 'ready' : 'blocked', blockers,
      capabilityStates: [{ capability: 'question.generate', enabled: configured, provider: 'local-deterministic', model: '', providerConfigured: installed,
        executionEnabled: ready, status: ready ? 'ready' : 'blocked', blockers }] };
  }
  async generate(input: { cellId: string; scopeId: string; seed: number }) {
    const output = await this.runtime().generateVerifiedQuestion(input);
    const r = output.result;
    if (output.applicationVersion !== '1.43.0' || output.providerCalls !== 0 || output.costUsd !== 0
      || output.task.cellId !== input.cellId || output.task.scopeId !== input.scopeId || output.task.seed !== input.seed
      || !r.passed || !r.gate?.passed || r.admission?.status !== 'eligible_before_history'
      || r.questionArtifact?.cellId !== input.cellId || r.questionArtifact?.scopeId !== input.scopeId
      || r.candidate?.subject !== 'math' || r.gate.checks.oracle !== true || r.gate.checks.solver !== true
      || Object.entries(r.gate.checks).some(([key, value]) => !['labNovelty', 'mathIdentity'].includes(key) && value !== true)) {
      throw new ServiceUnavailableException('VERIFIED_MATH_GENERATION_REJECTED');
    }
    this.evidence.set(output, digest(output));
    return output;
  }
  assertVerified(output: MathGenerationOutput) {
    if (!this.evidence.has(output) || this.evidence.get(output) !== digest(output)) throw new ServiceUnavailableException('VERIFIED_MATH_EVIDENCE_CHANGED');
  }
}
