import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { AdminSchoolsService } from './admin-schools.service';
import {
  AdminSchoolCreateInput,
  AdminSchoolCscaRuleInput,
  AdminSchoolCscaRuleUpdateInput,
  AdminSchoolImportInput,
  AdminSchoolProgramInput,
  AdminSchoolProgramUpdateInput,
  AdminSchoolScholarshipInput,
  AdminSchoolScholarshipUpdateInput,
  AdminSchoolUpdateInput
} from './schools.types';

@Controller()
@UseGuards(RequiredAdminGuard)
export class AdminSchoolsController {
  constructor(private readonly adminSchoolsService: AdminSchoolsService) {}

  @Get('api/v1/admin/schools')
  async listAdminSchools() {
    const result = await this.adminSchoolsService.listAdminSchools();
    return {
      items: result.items,
      mode: 'minimal-edit',
      summary: result.summary
    };
  }

  @Get('api/v1/admin/schools/:id')
  async getAdminSchool(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.adminSchoolsService.getAdminSchool(id);
  }

  @Get('api/v1/admin/schools/:id/change-logs')
  async listAdminSchoolChangeLogs(
    @Param('id', ParseIntPipe) id: number
  ) {
    return {
      items: await this.adminSchoolsService.listSchoolChangeLogs(id)
    };
  }

  @Post('api/v1/admin/schools')
  async createAdminSchool(
    @Body() body: AdminSchoolCreateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.createAdminSchool(body, user.id);
  }

  @Patch('api/v1/admin/schools/:id')
  async updateAdminSchool(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminSchoolUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.updateAdminSchool(id, body, user.id);
  }

  @Delete('api/v1/admin/schools/:id')
  async archiveAdminSchool(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminSchoolUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.archiveAdminSchool(id, user.id, body);
  }

  @Post('api/v1/admin/schools/:id/programs')
  async createAdminSchoolProgram(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminSchoolProgramInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.createAdminSchoolProgram(id, body, user.id);
  }

  @Patch('api/v1/admin/schools/:id/programs/:programId')
  async updateAdminSchoolProgram(
    @Param('id', ParseIntPipe) id: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Body() body: AdminSchoolProgramUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.updateAdminSchoolProgram(id, programId, body, user.id);
  }

  @Delete('api/v1/admin/schools/:id/programs/:programId')
  async archiveAdminSchoolProgram(
    @Param('id', ParseIntPipe) id: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Body() body: AdminSchoolProgramUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.archiveAdminSchoolProgram(id, programId, user.id, body);
  }

  @Post('api/v1/admin/schools/:id/csca-rules')
  async createAdminSchoolCscaRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminSchoolCscaRuleInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.createAdminSchoolCscaRule(id, body, user.id);
  }

  @Patch('api/v1/admin/schools/:id/csca-rules/:ruleId')
  async updateAdminSchoolCscaRule(
    @Param('id', ParseIntPipe) id: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() body: AdminSchoolCscaRuleUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.updateAdminSchoolCscaRule(id, ruleId, body, user.id);
  }

  @Delete('api/v1/admin/schools/:id/csca-rules/:ruleId')
  async archiveAdminSchoolCscaRule(
    @Param('id', ParseIntPipe) id: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() body: AdminSchoolCscaRuleUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.archiveAdminSchoolCscaRule(id, ruleId, user.id, body);
  }

  @Post('api/v1/admin/schools/:id/scholarships')
  async createAdminSchoolScholarship(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminSchoolScholarshipInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.createAdminSchoolScholarship(id, body, user.id);
  }

  @Patch('api/v1/admin/schools/:id/scholarships/:scholarshipId')
  async updateAdminSchoolScholarship(
    @Param('id', ParseIntPipe) id: number,
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
    @Body() body: AdminSchoolScholarshipUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.updateAdminSchoolScholarship(id, scholarshipId, body, user.id);
  }

  @Delete('api/v1/admin/schools/:id/scholarships/:scholarshipId')
  async archiveAdminSchoolScholarship(
    @Param('id', ParseIntPipe) id: number,
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
    @Body() body: AdminSchoolScholarshipUpdateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.archiveAdminSchoolScholarship(id, scholarshipId, user.id, body);
  }

  @Post('api/v1/admin/schools/import')
  async importAdminSchools(
    @Body() body: AdminSchoolImportInput | AdminSchoolCreateInput[],
    @CurrentUser() user: PrismaUser
  ) {
    return this.adminSchoolsService.importAdminSchools(body, user.id);
  }
}
