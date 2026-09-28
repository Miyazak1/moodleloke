import { Module } from '@nestjs/common';
import { AdminAuditModule } from './admin-audit/admin-audit.module';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { CscaMockExamModule } from './csca-mock-exam/csca-mock-exam.module';
import { CscaSpecialPracticeModule } from './csca-special-practice/csca-special-practice.module';
import { HealthModule } from './health/health.module';
import { LearningIntelligenceFoundationModule } from './learning-intelligence/learning-intelligence-foundation.module';
import { MeModule } from './me/me.module';
import { PastPapersModule } from './past-papers/past-papers.module';
import { QuestionEnginePluginModule } from './question-engine-plugin/question-engine-plugin.module';

@Module({
  imports: [
    AuthModule,
    AdminAuditModule,
    ContentModule,
    MeModule,
    CscaSpecialPracticeModule,
    CscaMockExamModule,
    PastPapersModule,
    LearningIntelligenceFoundationModule,
    AgentModule,
    QuestionEnginePluginModule,
    HealthModule
  ]
})
export class AppModule {}
