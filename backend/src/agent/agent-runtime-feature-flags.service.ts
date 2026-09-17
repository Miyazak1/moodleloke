import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';

function enabled(value: string | undefined): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

@Injectable()
export class AgentRuntimeFeatureFlagsService {
  constructor(@Optional() private readonly env: NodeJS.ProcessEnv = process.env) {}

  isWebEnabled(): boolean {
    return enabled(this.env.AGENT_WEB_ENABLED);
  }

  isPracticeWriteEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_PRACTICE_WRITE_ENABLED);
  }

  isTeachingAssetEnabled(): boolean {
    return this.isWebEnabled()
      && this.isPracticeWriteEnabled()
      && enabled(this.env.CSCA_AGENT_TEACHING_ASSET_ENABLED);
  }

  teachingAssetRoutingMode(): 'legacy' | 'shadow' | 'active' {
    const mode = String(this.env.CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE ?? 'legacy').trim().toLowerCase();
    return mode === 'active' || mode === 'shadow' ? mode : 'legacy';
  }

  teachingAssetRoutingRollout() {
    const subjects = String(this.env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS ?? '').split(',').map((value) => value.trim()).filter((value) => ['math', 'physics', 'chemistry'].includes(value));
    const parsed = Number(this.env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT ?? '0');
    const percent = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.floor(parsed))) : 0;
    return { subjects, percent };
  }

  teachingAssetRoutingModeFor(userId: number, subject: string): 'legacy' | 'shadow' | 'active' {
    const configured = this.teachingAssetRoutingMode();
    if (configured !== 'active') return configured;
    const rollout = this.teachingAssetRoutingRollout();
    if (!rollout.subjects.includes(subject) || rollout.percent <= 0) return 'shadow';
    const bucket = createHash('sha256').update(`teaching-routing-rollout-v1:${userId}`).digest().readUInt16BE(0) % 100;
    return bucket < rollout.percent ? 'active' : 'shadow';
  }

  isLlmRouterEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_LLM_ROUTER_ENABLED);
  }

  isLlmGroundedResponseEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_LLM_GROUNDED_RESPONSE_ENABLED);
  }

  isAttachmentsEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_ATTACHMENTS_ENABLED);
  }

  isAttachmentAnalysisEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_ATTACHMENT_ANALYSIS_ENABLED);
  }

  isAttachmentEvidenceEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_ATTACHMENT_EVIDENCE_ENABLED);
  }

  isTrustedQuestionMatchEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_TRUSTED_QUESTION_MATCH_ENABLED);
  }

  isMultiQuestionAnalysisEnabled(): boolean {
    return enabled(this.env.CSCA_AGENT_MULTI_QUESTION_ANALYSIS_ENABLED);
  }

  isQuestionSupplyRequestEnabled(): boolean {
    return enabled(this.env.CSCA_QUESTION_SUPPLY_REQUEST_ENABLED);
  }

  isQuestionSupplyFulfillmentShadowEnabled(): boolean {
    return this.isQuestionSupplyRequestEnabled() && enabled(this.env.CSCA_QUESTION_SUPPLY_FULFILLMENT_SHADOW_ENABLED);
  }

  isQuestionSupplyShadowSchedulerEnabled(): boolean {
    return this.isQuestionSupplyFulfillmentShadowEnabled()
      && enabled(this.env.CSCA_QUESTION_SUPPLY_SHADOW_SCHEDULER_ENABLED);
  }
}
