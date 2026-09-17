import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminUsersController } from './admin-users.controller';
import { AccessPolicyGuard } from './access-policy.guard';
import { OptionalUserGuard, RequiredAdminGuard, RequiredUserGuard } from './auth.guards';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, AdminUsersController],
  providers: [AuthService, AccessPolicyGuard, RequiredUserGuard, RequiredAdminGuard, OptionalUserGuard],
  exports: [AuthService, AccessPolicyGuard, RequiredUserGuard, RequiredAdminGuard, OptionalUserGuard]
})
export class AuthModule {}
