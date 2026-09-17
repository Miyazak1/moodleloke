import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CscaLearningModule } from '../csca-learning/csca-learning.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolsModule } from '../schools/schools.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [PrismaModule, AuthModule, SchoolsModule, CscaLearningModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService]
})
export class MeModule {}
