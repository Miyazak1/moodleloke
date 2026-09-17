import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { AdminScholarshipsService } from './admin-scholarships.service';

@Controller()
@UseGuards(RequiredAdminGuard)
export class AdminScholarshipsController {
  constructor(private readonly adminScholarshipsService: AdminScholarshipsService) {}

  @Get('api/v1/admin/scholarships')
  listAdminScholarships() {
    return this.adminScholarshipsService.listAdminScholarships();
  }

  @Post('api/v1/admin/scholarships')
  createAdminScholarship(
    @Body() body: unknown,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminScholarshipsService.createAdminScholarship(body as never, user.id);
  }

  @Patch('api/v1/admin/scholarships/:id')
  updateAdminScholarship(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminScholarshipsService.updateAdminScholarship(id, body as never, user.id);
  }

  @Delete('api/v1/admin/scholarships/:id')
  archiveAdminScholarship(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminScholarshipsService.archiveAdminScholarship(id, user.id, body as never);
  }

  @Post('api/v1/admin/scholarships/import')
  importAdminScholarships(
    @Body() body: unknown,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminScholarshipsService.importAdminScholarships(body as never, user.id);
  }
}
