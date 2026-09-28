import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionEnginePluginModule } from '../question-engine-plugin/question-engine-plugin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, QuestionEnginePluginModule],
  controllers: [HealthController]
})
export class HealthModule {}
