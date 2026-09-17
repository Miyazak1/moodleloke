import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiGatewayConcurrencyService } from './ai-gateway-concurrency.service';
import { AiGatewayConfigService } from './ai-gateway-config.service';
import { AiGatewayCostService } from './ai-gateway-cost.service';
import { AiGatewayKeyPoolService } from './ai-gateway-key-pool.service';
import { AiGatewayLedgerService } from './ai-gateway-ledger.service';
import { AiGatewayMonitorController } from './ai-gateway-monitor.controller';
import { AiGatewayMonitorService } from './ai-gateway-monitor.service';
import { AiGatewayService } from './ai-gateway.service';
import { DeepSeekProvider } from './providers/deepseek.provider';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiGatewayMonitorController],
  providers: [
    AiGatewayConfigService,
    AiGatewayConcurrencyService,
    AiGatewayKeyPoolService,
    AiGatewayLedgerService,
    AiGatewayCostService,
    AiGatewayMonitorService,
    DeepSeekProvider,
    AiGatewayService
  ],
  exports: [AiGatewayService]
})
export class AiGatewayModule {}
