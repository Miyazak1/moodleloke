import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User as PrismaUser } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { OptionalUserGuard, RequiredAdminGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import { buildPastPaperFileUrl, ensurePastPaperUploadDir } from './past-paper-storage';
import { PastPapersService } from './past-papers.service';
import { PastPaperFileInput, PastPaperInput, ResourceBundleInput, ResourceBundleItemInput } from './past-papers.types';

const { diskStorage } = require('multer');

function uploadLimitBytes() {
  const mb = Number(process.env.PAST_PAPER_UPLOAD_LIMIT_MB || 50);
  return Math.max(1, Math.min(Number.isFinite(mb) ? mb : 50, 200)) * 1024 * 1024;
}

function safeUploadName(request: any, file: { originalname?: string }, callback: (error: Error | null, filename?: string) => void) {
  const paperId = String(request.params?.id ?? 'paper').replace(/[^a-zA-Z0-9-]/g, '');
  const extension = (file.originalname || '').toLowerCase().endsWith('.pdf') ? '.pdf' : '.pdf';
  callback(null, `past-paper-${paperId}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`);
}

const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_request: any, _file: unknown, callback: (error: Error | null, destination?: string) => void) => callback(null, ensurePastPaperUploadDir()),
    filename: safeUploadName
  }),
  limits: { fileSize: uploadLimitBytes() },
  fileFilter: (_request: any, file: { mimetype?: string; originalname?: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const looksPdf = file.mimetype === 'application/pdf' || (file.originalname || '').toLowerCase().endsWith('.pdf');
    callback(looksPdf ? null : new BadRequestException('目前只支持上传 PDF 文件。'), looksPdf);
  }
});

@Controller()
export class PastPapersController {
  constructor(private readonly pastPapersService: PastPapersService) {}

  @Get(['past-papers', 'api/v1/past-papers'])
  listPublic(@Query('subject') subject?: string, @Query('category') category?: string, @Query('locale') locale?: string) {
    return this.pastPapersService.listPublic({ subject, category, locale });
  }

  @Get(['resource-bundles', 'api/v1/resource-bundles'])
  listPublicBundles(@Query('subject') subject?: string, @Query('category') category?: string, @Query('locale') locale?: string) {
    return this.pastPapersService.listPublicBundles({ subject, category, locale });
  }

  @Get(['resource-bundles/:slug', 'api/v1/resource-bundles/:slug'])
  getPublicBundle(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.pastPapersService.getPublicBundle(slug, locale);
  }

  @Get(['past-papers/:slug', 'api/v1/past-papers/:slug'])
  getPublic(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.pastPapersService.getPublic(slug, locale);
  }

  @Post(['past-papers/:slug/downloads/:fileId', 'api/v1/past-papers/:slug/downloads/:fileId'])
  @UseGuards(OptionalUserGuard)
  recordDownload(@Param('slug') slug: string, @Param('fileId') fileId: string, @Req() request: any, @CurrentUser() user?: PrismaUser) {
    return this.pastPapersService.recordDownload(slug, fileId, {
      userId: user?.id,
      ip: request.ip ?? request.socket?.remoteAddress,
      userAgent: request.headers?.['user-agent']
    });
  }

  @Get('api/v1/admin/past-papers')
  @UseGuards(RequiredAdminGuard)
  listAdmin(@Query('subject') subject?: string, @Query('category') category?: string) {
    return this.pastPapersService.listAdmin({ subject, category });
  }

  @Get('api/v1/admin/past-paper-source-documents')
  @UseGuards(RequiredAdminGuard)
  listAdminSourceDocuments(@Query('subject') subject?: string) {
    return this.pastPapersService.listAdminSourceDocuments(subject);
  }

  @Get('api/v1/admin/resource-bundles')
  @UseGuards(RequiredAdminGuard)
  listAdminBundles(@Query('subject') subject?: string, @Query('category') category?: string, @Query('status') status?: string) {
    return this.pastPapersService.listAdminBundles({ subject, category, status });
  }

  @Get('api/v1/admin/resource-bundles/:id')
  @UseGuards(RequiredAdminGuard)
  getAdminBundle(@Param('id') id: string) {
    return this.pastPapersService.getAdminBundle(id);
  }

  @Post('api/v1/admin/resource-bundles')
  @UseGuards(RequiredAdminGuard)
  createAdminBundle(@Body() body: ResourceBundleInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.createAdminBundle(body, user.id);
  }

  @Patch('api/v1/admin/resource-bundles/:id')
  @UseGuards(RequiredAdminGuard)
  updateAdminBundle(@Param('id') id: string, @Body() body: ResourceBundleInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.updateAdminBundle(id, body, user.id);
  }

  @Post('api/v1/admin/resource-bundles/:id/publish')
  @UseGuards(RequiredAdminGuard)
  publishAdminBundle(@Param('id') id: string, @Body() body: ResourceBundleInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.publishAdminBundle(id, body, user.id);
  }

  @Post('api/v1/admin/resource-bundles/:id/archive')
  @UseGuards(RequiredAdminGuard)
  archiveAdminBundle(@Param('id') id: string, @Body() body: ResourceBundleInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.archiveAdminBundle(id, body, user.id);
  }

  @Post('api/v1/admin/resource-bundles/:id/items')
  @UseGuards(RequiredAdminGuard)
  createAdminBundleItem(@Param('id') id: string, @Body() body: ResourceBundleItemInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.createAdminBundleItem(id, body, user.id);
  }

  @Patch('api/v1/admin/resource-bundles/:id/items/:itemId')
  @UseGuards(RequiredAdminGuard)
  updateAdminBundleItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: ResourceBundleItemInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.updateAdminBundleItem(id, itemId, body, user.id);
  }

  @Delete('api/v1/admin/resource-bundles/:id/items/:itemId')
  @UseGuards(RequiredAdminGuard)
  deleteAdminBundleItem(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.deleteAdminBundleItem(id, itemId, user.id);
  }

  @Get('api/v1/admin/past-papers/:id')
  @UseGuards(RequiredAdminGuard)
  getAdmin(@Param('id') id: string) {
    return this.pastPapersService.getAdmin(id);
  }

  @Post('api/v1/admin/past-papers')
  @UseGuards(RequiredAdminGuard)
  createAdmin(@Body() body: PastPaperInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.createAdmin(body, user.id);
  }

  @Patch('api/v1/admin/past-papers/:id')
  @UseGuards(RequiredAdminGuard)
  updateAdmin(@Param('id') id: string, @Body() body: PastPaperInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.updateAdmin(id, body, user.id);
  }

  @Post('api/v1/admin/past-papers/:id/publish')
  @UseGuards(RequiredAdminGuard)
  publishAdmin(@Param('id') id: string, @Body() body: PastPaperInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.publishAdmin(id, body, user.id);
  }

  @Post('api/v1/admin/past-papers/:id/archive')
  @UseGuards(RequiredAdminGuard)
  archiveAdmin(@Param('id') id: string, @Body() body: PastPaperInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.archiveAdmin(id, body, user.id);
  }

  @Post('api/v1/admin/past-papers/:id/files')
  @UseGuards(RequiredAdminGuard)
  createAdminFile(@Param('id') id: string, @Body() body: PastPaperFileInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.createAdminFile(id, body, user.id);
  }

  @Post('api/v1/admin/past-papers/:id/files/upload')
  @UseGuards(RequiredAdminGuard)
  @UseInterceptors(uploadInterceptor)
  uploadAdminFile(
    @Param('id') id: string,
    @Body() body: Pick<PastPaperFileInput, 'kind' | 'label'>,
    @UploadedFile() file: { filename: string; originalname: string; mimetype: string; size: number; path: string } | undefined,
    @CurrentUser() user: PrismaUser
  ) {
    if (!file) throw new BadRequestException('请选择要上传的 PDF 文件。');
    return this.pastPapersService.createAdminUploadedFile(
      id,
      {
        kind: body.kind,
        label: body.label,
        fileUrl: buildPastPaperFileUrl(file.filename),
        originalFilename: file.originalname,
        mimeType: file.mimetype || 'application/pdf',
        fileSizeBytes: file.size
      },
      file.path,
      user.id
    );
  }

  @Patch('api/v1/admin/past-papers/:id/files/:fileId')
  @UseGuards(RequiredAdminGuard)
  updateAdminFile(@Param('id') id: string, @Param('fileId') fileId: string, @Body() body: PastPaperFileInput, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.updateAdminFile(id, fileId, body, user.id);
  }

  @Delete('api/v1/admin/past-papers/:id/files/:fileId')
  @UseGuards(RequiredAdminGuard)
  deleteAdminFile(@Param('id') id: string, @Param('fileId') fileId: string, @CurrentUser() user: PrismaUser) {
    return this.pastPapersService.deleteAdminFile(id, fileId, user.id);
  }
}
