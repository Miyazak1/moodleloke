import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import { LearningCapabilityError } from './learning-capability.error';
import {
  LEARNING_READ_CAPABILITY_VERSION,
  LEARNING_READ_SCOPE,
  LearningCapabilityContextSchema,
  LearningCapabilityFailure,
  LearningCapabilityResponse,
  LearningReadCapabilityDefinition,
  LearningReadCapabilityInputSchemas,
  LearningReadCapabilityName,
  LearningReadCapabilityOutputSchemas
} from './learning-read-capability.contracts';
import { LearningReadCapabilityService } from './learning-read-capability.service';

const CHANNELS = ['web_agent', 'codex_plugin', 'chatgpt_plugin', 'internal'] as const;

const DEFINITIONS: readonly LearningReadCapabilityDefinition[] = [
  ['get_learning_profile', 'Read the current student learning profile and long-term study preferences.'],
  ['get_score_goal', 'Read the current versioned CSCA score goal.'],
  ['get_study_availability', 'Read the current long-term study availability preference.'],
  ['get_subject_mastery', 'Read current subject and topic mastery evidence.'],
  ['get_review_queue', 'Read the current user\'s review queue.'],
  ['list_mock_exam_attempts', 'List the current user\'s recent mock exam attempts.'],
  ['search_past_papers', 'Search published past-paper resources without exposing administrative records.'],
  ['get_question_supply_status', 'Check qualified published question supply without generating questions.'],
  ['get_intervention_stability', 'Read the current user-owned intervention verification and stable-mastery assessment.'],
  ['get_target_gap', 'Read the current evidence-backed target gap snapshot.'],
  ['get_learning_prescription', 'Read the current deterministic learning prescription.'],
  ['get_score_readiness', 'Read the current shadow readiness gate without uncalibrated score claims.']
].map(([name, description]) => ({
  name: name as LearningReadCapabilityName,
  version: LEARNING_READ_CAPABILITY_VERSION,
  scope: LEARNING_READ_SCOPE,
  riskLevel: 0 as const,
  aiCredits: 0 as const,
  channels: CHANNELS,
  description
}));

const DEFINITION_BY_NAME = new Map(DEFINITIONS.map((definition) => [definition.name, definition]));

@Injectable()
export class LearningCapabilityRegistryService {
  constructor(
    private readonly capabilities: LearningReadCapabilityService,
    private readonly featureFlags: LearningIntelligenceFeatureFlagsService
  ) {}

  list(): readonly LearningReadCapabilityDefinition[] {
    return DEFINITIONS;
  }

  getDefinition(name: LearningReadCapabilityName): LearningReadCapabilityDefinition | undefined {
    return DEFINITION_BY_NAME.get(name);
  }

  getInputSchema(name: LearningReadCapabilityName) {
    return LearningReadCapabilityInputSchemas[name];
  }

  getOutputSchema(name: LearningReadCapabilityName) {
    return LearningReadCapabilityOutputSchemas[name];
  }

  async invoke(nameValue: string, contextValue: unknown, inputValue: unknown): Promise<LearningCapabilityResponse> {
    const requestId = this.requestIdFrom(contextValue);
    const definition = DEFINITION_BY_NAME.get(nameValue as LearningReadCapabilityName);
    if (!definition) return this.failure(nameValue, requestId, new LearningCapabilityError('RESOURCE_NOT_FOUND', 'Capability not found.'));

    const contextResult = LearningCapabilityContextSchema.safeParse(contextValue);
    if (!contextResult.success) return this.validationFailure(nameValue, requestId, contextResult.error);
    const context = contextResult.data;
    if (!context.grantedScopes.includes(definition.scope)) {
      return this.failure(nameValue, context.requestId, new LearningCapabilityError('AUTHORIZATION_DENIED', 'Required scope is not granted.'));
    }
    if (!this.featureFlags.isEnabled('foundation')) {
      return this.failure(nameValue, context.requestId, new LearningCapabilityError('TOOL_UNAVAILABLE', 'Learning capabilities are not enabled.', true));
    }
    if (definition.name === 'get_target_gap' && !this.featureFlags.isEnabled('targetGap')) {
      return this.failure(nameValue, context.requestId, new LearningCapabilityError('TOOL_UNAVAILABLE', 'Target Gap is not enabled.', true));
    }
    if (definition.name === 'get_learning_prescription' && !this.featureFlags.isEnabled('prescription')) {
      return this.failure(nameValue, context.requestId, new LearningCapabilityError('TOOL_UNAVAILABLE', 'Learning Prescription is not enabled.', true));
    }
    if (definition.name === 'get_score_readiness' && !this.featureFlags.isEnabled('scoreReadiness')) {
      return this.failure(nameValue, context.requestId, new LearningCapabilityError('TOOL_UNAVAILABLE', 'Score Readiness is not enabled.', true));
    }

    const inputResult = LearningReadCapabilityInputSchemas[definition.name].safeParse(inputValue ?? {});
    if (!inputResult.success) return this.validationFailure(nameValue, context.requestId, inputResult.error);

    try {
      const data = await this.execute(definition.name, context.actorUserId, inputResult.data as never);
      const output = LearningReadCapabilityOutputSchemas[definition.name].parse(data);
      return {
        ok: true,
        tool: definition.name,
        toolVersion: LEARNING_READ_CAPABILITY_VERSION,
        requestId: context.requestId,
        data: output,
        usage: { creditsCharged: 0, meteringSource: 'none' },
        confirmation: null
      };
    } catch (error) {
      if (error instanceof LearningCapabilityError) return this.failure(nameValue, context.requestId, error);
      return this.failure(nameValue, context.requestId, new LearningCapabilityError('INTERNAL_ERROR', 'Capability execution failed.', true));
    }
  }

  private execute(name: LearningReadCapabilityName, actorUserId: number, input: Record<string, unknown>) {
    switch (name) {
      case 'get_learning_profile': return this.capabilities.getLearningProfile(actorUserId);
      case 'get_score_goal': return this.capabilities.getScoreGoal(actorUserId);
      case 'get_study_availability': return this.capabilities.getStudyAvailability(actorUserId);
      case 'get_subject_mastery': return this.capabilities.getSubjectMastery(actorUserId, input);
      case 'get_review_queue': return this.capabilities.getReviewQueue(actorUserId, input);
      case 'list_mock_exam_attempts': return this.capabilities.listMockExamAttempts(actorUserId, input);
      case 'search_past_papers': return this.capabilities.searchPastPapers(input);
      case 'get_question_supply_status': return this.capabilities.getQuestionSupplyStatus(input as never);
      case 'get_intervention_stability': return this.capabilities.getInterventionStability(actorUserId, input as { verificationId: string });
      case 'get_target_gap': return this.capabilities.getTargetGap(actorUserId);
      case 'get_learning_prescription': return this.capabilities.getLearningPrescription(actorUserId);
      case 'get_score_readiness': return this.capabilities.getScoreReadiness(actorUserId);
    }
  }

  private requestIdFrom(value: unknown): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'unknown';
    const requestId = (value as Record<string, unknown>).requestId;
    return typeof requestId === 'string' && requestId ? requestId.slice(0, 120) : 'unknown';
  }

  private validationFailure(tool: string, requestId: string, error: z.ZodError): LearningCapabilityFailure {
    return this.failure(tool, requestId, new LearningCapabilityError(
      'VALIDATION_ERROR',
      'Capability input is invalid.',
      false,
      error.issues.map((issue) => ({ field: issue.path.join('.') || '$', code: issue.code, message: issue.message }))
    ));
  }

  private failure(tool: string, requestId: string, error: LearningCapabilityError): LearningCapabilityFailure {
    return {
      ok: false,
      tool,
      toolVersion: LEARNING_READ_CAPABILITY_VERSION,
      requestId,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        ...(error.fieldErrors?.length ? { fieldErrors: error.fieldErrors } : {})
      },
      usage: { creditsCharged: 0, meteringSource: 'none' },
      confirmation: null
    };
  }
}
