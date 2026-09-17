import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CscaLearningModule } from '../csca-learning/csca-learning.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';

@Module({
  imports: [PrismaModule, AuthModule, CscaLearningModule],
  controllers: [AdminAuditController],
  providers: [AdminAuditService]
})
export class AdminAuditModule {}
