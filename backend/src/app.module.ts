import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './auth/auth.module';
import { CscaMockExamModule } from './csca-mock-exam/csca-mock-exam.module';
import { CscaSpecialPracticeModule } from './csca-special-practice/csca-special-practice.module';
import { HealthModule } from './health/health.module';
import { LearningIntelligenceFoundationModule } from './learning-intelligence/learning-intelligence-foundation.module';
import { MeModule } from './me/me.module';
import { PastPapersModule } from './past-papers/past-papers.module';

@Module({
  imports: [
    AuthModule,
    MeModule,
    CscaSpecialPracticeModule,
    CscaMockExamModule,
    PastPapersModule,
    LearningIntelligenceFoundationModule,
    AgentModule,
    HealthModule
  ]
})
export class AppModule {}
