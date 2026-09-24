import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CscaSpecialPracticeModule } from '../csca-special-practice/csca-special-practice.module';
import { LearningIntelligenceFoundationModule } from '../learning-intelligence/learning-intelligence-foundation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentController } from './agent.controller';
import { AgentEventService } from './agent-event.service';
import { AgentRecoveryService } from './agent-recovery.service';
import { AgentRunnerService } from './agent-runner.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { AgentToolExecutorService } from './agent-tool-executor.service';
import { AgentPracticeActionService } from './agent-practice-action.service';
import { AgentService } from './agent.service';
import { AgentAttachmentService } from './agent-attachment.service';
import { AgentAttachmentAnalysisService } from './agent-attachment-analysis.service';
import { AgentAttachmentEvidenceService } from './agent-attachment-evidence.service';
import { AgentTrustedQuestionMatcherService } from './agent-trusted-question-matcher.service';
import { AgentInterventionDeliveryService } from './agent-intervention-delivery.service';
import { AgentInterventionVerificationService } from './agent-intervention-verification.service';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { QuestionSupplyRequestController } from './question-supply-request.controller';
import { QuestionSupplyRequestService } from './question-supply-request.service';
import { QUESTION_SUPPLY_PRODUCTION_ADAPTER } from './question-supply-fulfillment.contract';
import { QuestionSupplyFulfillmentService } from './question-supply-fulfillment.service';
import { QuestionSupplyShadowAdapter } from './question-supply-shadow.adapter';
import { QuestionSupplyEvaluationService } from './question-supply-evaluation.service';
import { QuestionSupplyShadowSchedulerService } from './question-supply-shadow-scheduler.service';
import { QuestionSupplyOperationsHealthService } from './question-supply-operations-health.service';
import { AgentIntentRouterService } from './agent-intent-router.service';
import { AgentGroundedResponseService } from './agent-grounded-response.service';
import { AgentLearningAssistanceService } from './agent-learning-assistance.service';
import { AgentTeachingAssetService } from './agent-teaching-asset.service';
import { AdminTeachingAssetsController } from './admin-teaching-assets.controller';
import { AdminTeachingAssetsService } from './admin-teaching-assets.service';
import { TeachingAssetRoutingOutcomeService } from './teaching-asset-routing-outcome.service';
import { AgentPracticeQuestionContextService } from './agent-practice-question-context.service';
import { AgentPastPaperQuestionService } from './agent-past-paper-question.service';
import { AgentPastPaperAssistanceService } from './agent-past-paper-assistance.service';
import { AgentPastPaperAttemptService } from './agent-past-paper-attempt.service';
import { AgentJourneyReadService } from './agent-journey-read.service';
import { AgentSubjectQaService } from './agent-subject-qa.service';
import { CscaMockExamModule } from '../csca-mock-exam/csca-mock-exam.module';
import { PastPapersModule } from '../past-papers/past-papers.module';
import { AgentConversationLifecycleService } from './agent-conversation-lifecycle.service';

@Module({
  imports: [PrismaModule, AuthModule, LearningIntelligenceFoundationModule, CscaSpecialPracticeModule, CscaMockExamModule, PastPapersModule, AiGatewayModule],
  controllers: [AgentController, QuestionSupplyRequestController, AdminTeachingAssetsController],
  providers: [
    AgentRuntimeFeatureFlagsService,
    AgentIntentRouterService,
    AgentGroundedResponseService,
    AgentEventService,
    AgentToolExecutorService,
    AgentAttachmentService,
    AgentAttachmentAnalysisService,
    AgentAttachmentEvidenceService,
    AgentTrustedQuestionMatcherService,
    AgentInterventionDeliveryService,
    AgentInterventionVerificationService,
    QuestionSupplyRequestService,
    QuestionSupplyShadowAdapter,
    { provide: QUESTION_SUPPLY_PRODUCTION_ADAPTER, useExisting: QuestionSupplyShadowAdapter },
    QuestionSupplyFulfillmentService,
    QuestionSupplyEvaluationService,
    QuestionSupplyShadowSchedulerService,
    QuestionSupplyOperationsHealthService,
    AgentPracticeActionService,
    AgentPracticeQuestionContextService,
    AgentPastPaperQuestionService,
    AgentPastPaperAssistanceService,
    AgentPastPaperAttemptService,
    AgentJourneyReadService,
    AgentSubjectQaService,
    AgentLearningAssistanceService,
    AgentTeachingAssetService,
    TeachingAssetRoutingOutcomeService,
    AdminTeachingAssetsService,
    AgentRunnerService,
    AgentRecoveryService,
    AgentConversationLifecycleService,
    AgentService
  ],
  exports: [AgentService]
})
export class AgentModule {}
