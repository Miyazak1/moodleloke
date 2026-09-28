import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { ContentService } from './content.service';
import { AdminContentBlockCreateInput, AdminContentBlockInput } from './content.types';

@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('api/v1/content/home')
  async listBlocks(@Query('locale') locale?: string) {
    return {
      items: await this.contentService.listBlocks(locale)
    };
  }

  @Get(['api/v1/admin/content/blocks'])
  @UseGuards(RequiredAdminGuard)
  async listAdminBlocks(@Query('locale') locale?: string) {
    return {
      items: await this.contentService.listAdminBlocks(locale),
      mode: 'minimal-cms'
    };
  }

  @Post(['api/v1/admin/content/blocks'])
  @UseGuards(RequiredAdminGuard)
  async createAdminBlock(
    @Body() body: AdminContentBlockCreateInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.contentService.createBlock(body, user.id);
  }

  @Patch(['api/v1/admin/content/blocks/:key'])
  @UseGuards(RequiredAdminGuard)
  async updateAdminBlock(
    @Param('key') key: string,
    @Query('locale') locale: string | undefined,
    @Body() body: AdminContentBlockInput,
    @CurrentUser() user: PrismaUser
  ) {
    return this.contentService.updateBlock(key, body, user.id, locale);
  }

  @Post(['api/v1/admin/content/blocks/:key/publish'])
  @UseGuards(RequiredAdminGuard)
  async publishAdminBlock(
    @Param('key') key: string,
    @Query('locale') locale: string | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.contentService.publishBlock(key, user.id, body, locale);
  }

  @Delete(['api/v1/admin/content/blocks/:key'])
  @UseGuards(RequiredAdminGuard)
  async archiveAdminBlock(
    @Param('key') key: string,
    @Query('locale') locale: string | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.contentService.archiveBlock(key, user.id, body, locale);
  }
}
