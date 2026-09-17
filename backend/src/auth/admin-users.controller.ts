import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from './current-user.decorator';
import { RequiredAdminGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { AdminUserCreateInput, AdminUserStatusInput } from './auth.types';

@Controller()
@UseGuards(RequiredAdminGuard)
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Get('api/v1/admin/users')
  async listAdminUsers() {
    return this.authService.listAdminUsers();
  }

  @Post('api/v1/admin/users')
  async createAdminUser(
    @Body() body: AdminUserCreateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.authService.createAdminUser(body, user.id);
  }

  @Patch('api/v1/admin/users/:id/status')
  async setAdminUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminUserStatusInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.authService.setUserStatus(id, body.status, user.id);
  }
}
