import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureAgentAttachmentRoot, resolveAgentStorageKey } from './agent-attachment-storage';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';

const SUPPORTED = new Map([
  ['application/pdf', { kind: 'document', extension: '.pdf' }],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', { kind: 'document', extension: '.docx' }],
  ['image/png', { kind: 'image', extension: '.png' }],
  ['image/jpeg', { kind: 'image', extension: '.jpg' }],
  ['image/webp', { kind: 'image', extension: '.webp' }]
]);

const EXTENSION_MIME = new Map([
  ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
]);

const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

function uploadLimitBytes() {
  const configured = Number(process.env.AGENT_ATTACHMENT_MAX_MB || 50);
  return Math.max(1, Math.min(Number.isFinite(configured) ? configured : 50, 100)) * 1024 * 1024;
}

function cleanFileName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException({ code: 'ATTACHMENT_NAME_INVALID', message: '附件文件名无效。' });
  }
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* keep raw header */ }
  const name = basename(decoded.replace(/[\u0000-\u001f\u007f]/g, '')).trim().slice(0, 255);
  if (!name || name === '.' || name === '..') {
    throw new BadRequestException({ code: 'ATTACHMENT_NAME_INVALID', message: '附件文件名无效。' });
  }
  return name;
}

export function publicAgentAttachment(row: any) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    status: row.status,
    kind: row.kind,
    name: row.originalName,
    declaredMime: row.declaredMime,
    detectedMime: row.detectedMime,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    error: row.errorCode ? { code: row.errorCode, message: row.errorMessage || '附件处理失败。' } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    previewUrl: row.status === 'ready' ? `/api/v1/agent/attachments/${row.id}/content` : null,
    sent: Number(row._count?.messages || 0) > 0,
    pages: Array.isArray(row.pages) ? row.pages.map((page: any) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      extractionMethod: page.extractionMethod,
      textAvailable: Boolean(page.extractedText)
    })) : undefined
  };
}

function textChunks(text: string, size = 4000) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let offset = 0; offset < normalized.length; offset += size) chunks.push(normalized.slice(offset, offset + size));
  return chunks;
}

@Injectable()
export class AgentAttachmentService {
  constructor(private readonly prisma: PrismaService, private readonly flags: AgentRuntimeFeatureFlagsService) {}

  limits() {
    this.assertEnabled();
    return {
      maxFileBytes: uploadLimitBytes(), maxFilesPerMessage: 5, maxMessageBytes: 100 * 1024 * 1024,
      maxDocumentPages: 200, acceptedMimeTypes: [...SUPPORTED.keys()]
    };
  }

  async upload(userId: number, conversationId: string, request: any, encodedName: unknown, declaredMime?: string) {
    this.assertEnabled();
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null, status: 'active' }, select: { id: true }
    });
    if (!conversation) throw new NotFoundException('Agent conversation not found.');

    const originalName = cleanFileName(encodedName);
    const declared = String(declaredMime || request.headers['content-type'] || '').split(';')[0].trim().toLowerCase() || null;
    const extension = extname(originalName).toLowerCase();
    const expectedMime = EXTENSION_MIME.get(extension);
    if (!expectedMime) throw new BadRequestException({ code: 'ATTACHMENT_TYPE_UNSUPPORTED', message: '仅支持 PDF、DOCX、PNG、JPEG 和 WebP。' });
    const contentLength = Number(request.headers['content-length'] || 0);
    if (contentLength > uploadLimitBytes()) {
      throw new BadRequestException({ code: 'ATTACHMENT_TOO_LARGE', message: `单个附件不能超过 ${Math.round(uploadLimitBytes() / 1024 / 1024)} MB。` });
    }

    const attachment = await this.prisma.agentAttachment.create({
      data: {
        userId, conversationId, status: 'uploading', kind: expectedMime.startsWith('image/') ? 'image' : 'document',
        originalName, declaredMime: declared, retainedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    ensureAgentAttachmentRoot();
    const storageKey = join(String(userId), conversationId, `${attachment.id}${extension}`).replace(/\\/g, '/');
    const finalPath = resolveAgentStorageKey(storageKey);
    const temporaryPath = `${finalPath}.part`;
    await mkdir(dirname(finalPath), { recursive: true });

    let sizeBytes = 0;
    const hash = createHash('sha256');
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        sizeBytes += chunk.length;
        if (sizeBytes > uploadLimitBytes()) return callback(new Error('ATTACHMENT_TOO_LARGE'));
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    try {
      await pipeline(request, meter, createWriteStream(temporaryPath, { flags: 'wx' }));
      if (!sizeBytes) throw new Error('ATTACHMENT_EMPTY');
      const { fileTypeFromFile } = await importEsm('file-type');
      const detected = await fileTypeFromFile(temporaryPath);
      const detectedMime = detected?.mime || '';
      if (!SUPPORTED.has(detectedMime) || detectedMime !== expectedMime) throw new Error('ATTACHMENT_SIGNATURE_MISMATCH');
      await rename(temporaryPath, finalPath);
      await this.prisma.agentAttachment.update({
        where: { id: attachment.id },
        data: { status: 'uploaded', detectedMime, sizeBytes, sha256: hash.digest('hex'), storageKey }
      });
      await this.extract(userId, attachment.id);
      return this.get(userId, attachment.id);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      const code = error instanceof Error ? error.message : 'ATTACHMENT_UPLOAD_FAILED';
      const rejected = ['ATTACHMENT_TOO_LARGE', 'ATTACHMENT_EMPTY', 'ATTACHMENT_SIGNATURE_MISMATCH'].includes(code);
      await this.prisma.agentAttachment.updateMany({
        where: { id: attachment.id, userId },
        data: { status: rejected ? 'rejected' : 'failed', errorCode: code.slice(0, 80), errorMessage: this.errorMessage(code) }
      });
      if (rejected) throw new BadRequestException({ code, message: this.errorMessage(code) });
      throw error;
    }
  }

  async uploadForPracticeQuestion(
    userId: number,
    roundIdValue: string,
    questionIdValue: string,
    request: any,
    encodedName: unknown,
    declaredMime?: string
  ) {
    const roundId = Number(roundIdValue);
    const questionId = Number(questionIdValue);
    if (!Number.isInteger(roundId) || roundId <= 0 || !Number.isInteger(questionId) || questionId <= 0) {
      throw new BadRequestException({ code: 'PRACTICE_QUESTION_INVALID', message: '练习题目无效。' });
    }
    const [roundItem, artifact] = await Promise.all([
      this.prisma.cscaAdaptiveRoundItem.findFirst({
        where: { roundId, questionId, round: { session: { userId } } },
        select: { id: true }
      }),
      this.prisma.agentArtifact.findFirst({
        where: { userId, domainEntityType: 'csca_adaptive_round', domainEntityId: String(roundId) },
        orderBy: { createdAt: 'desc' },
        select: { conversationId: true }
      })
    ]);
    if (!roundItem || !artifact) throw new NotFoundException('Agent practice question not found.');
    return this.upload(userId, artifact.conversationId, request, encodedName, declaredMime);
  }

  async list(userId: number, conversationId: string) {
    this.assertEnabled();
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null }, select: { id: true }
    });
    if (!conversation) throw new NotFoundException('Agent conversation not found.');
    const rows = await this.prisma.agentAttachment.findMany({
      where: { userId, conversationId, deletedAt: null }, orderBy: { createdAt: 'asc' },
      include: { pages: { orderBy: { pageNumber: 'asc' } }, _count: { select: { messages: true } } }
    });
    return { items: rows.map(publicAgentAttachment), limits: this.limits() };
  }

  async get(userId: number, attachmentId: string) {
    this.assertEnabled();
    const row = await this.prisma.agentAttachment.findFirst({
      where: { id: attachmentId, userId, deletedAt: null, conversation: { deletedAt: null } },
      include: { pages: { orderBy: { pageNumber: 'asc' } }, _count: { select: { messages: true } } }
    });
    if (!row) throw new NotFoundException('Attachment not found.');
    return publicAgentAttachment(row);
  }

  async content(userId: number, attachmentId: string) {
    this.assertEnabled();
    const row = await this.prisma.agentAttachment.findFirst({
      where: { id: attachmentId, userId, deletedAt: null, status: 'ready', conversation: { deletedAt: null } }
    });
    if (!row?.storageKey) throw new NotFoundException('Attachment content not found.');
    const path = resolveAgentStorageKey(row.storageKey);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('Attachment content not found.');
    return { path, name: row.originalName, mime: row.detectedMime || 'application/octet-stream', size: info.size };
  }

  async retry(userId: number, attachmentId: string) {
    this.assertEnabled();
    const row = await this.prisma.agentAttachment.findFirst({ where: { id: attachmentId, userId, deletedAt: null } });
    if (!row?.storageKey) throw new NotFoundException('Attachment not found.');
    if (!['failed', 'uploaded'].includes(row.status)) throw new ConflictException('Only failed extraction can be retried.');
    await this.extract(userId, row.id);
    return this.get(userId, row.id);
  }

  async remove(userId: number, attachmentId: string) {
    this.assertEnabled();
    const row = await this.prisma.agentAttachment.findFirst({ where: { id: attachmentId, userId, deletedAt: null } });
    if (!row) throw new NotFoundException('Attachment not found.');
    const [linked, examEvidenceLinks] = await Promise.all([
      this.prisma.agentMessageAttachment.count({ where: { attachmentId } }),
      this.prisma.studentExamOutcomeEvidence.count({ where: { attachmentId } })
    ]);
    if (linked) throw new ConflictException({ code: 'ATTACHMENT_ALREADY_SENT', message: '已随消息发送的附件不能直接移除。' });
    if (examEvidenceLinks) throw new ConflictException({
      code: 'ATTACHMENT_IS_EXAM_EVIDENCE', message: '该附件已作为考试成绩核验证据，不能直接删除；撤回同意会立即停止其校准用途。'
    });
    if (row.storageKey) await rm(resolveAgentStorageKey(row.storageKey), { force: true }).catch(() => undefined);
    await this.prisma.$transaction([
      this.prisma.agentAttachmentChunk.deleteMany({ where: { attachmentId } }),
      this.prisma.agentAttachmentPage.deleteMany({ where: { attachmentId } }),
      this.prisma.agentAttachment.update({ where: { id: attachmentId }, data: { status: 'deleted', deletedAt: new Date(), storageKey: null } })
    ]);
    return { id: attachmentId, status: 'deleted' };
  }

  private async extract(userId: number, attachmentId: string) {
    const row = await this.prisma.agentAttachment.findFirst({ where: { id: attachmentId, userId, deletedAt: null } });
    if (!row?.storageKey || !row.detectedMime) throw new NotFoundException('Attachment source not found.');
    await this.prisma.agentAttachment.update({ where: { id: row.id }, data: { status: 'extracting', errorCode: null, errorMessage: null } });
    try {
      const pages = row.detectedMime === 'application/pdf'
        ? await this.extractPdf(resolveAgentStorageKey(row.storageKey))
        : row.detectedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ? await this.extractDocx(resolveAgentStorageKey(row.storageKey))
          : [{ pageNumber: 1, width: null, height: null, text: '', method: 'none' }];
      if (pages.length > 200) throw new Error('ATTACHMENT_PAGE_LIMIT_EXCEEDED');
      const chunks: Array<{ pageIndex: number; ordinal: number; text: string; method: string }> = [];
      let ordinal = 0;
      pages.forEach((page, pageIndex) => textChunks(page.text).forEach((text) => chunks.push({ pageIndex, ordinal: ordinal++, text, method: page.method })));
      await this.prisma.$transaction(async (tx) => {
        await tx.agentAttachmentChunk.deleteMany({ where: { attachmentId: row.id } });
        await tx.agentAttachmentPage.deleteMany({ where: { attachmentId: row.id } });
        const createdPages = [];
        for (const page of pages) {
          createdPages.push(await tx.agentAttachmentPage.create({ data: {
            attachmentId: row.id, pageNumber: page.pageNumber, width: page.width, height: page.height,
            extractedText: page.text || null, extractionMethod: page.method
          } }));
        }
        for (const chunk of chunks) {
          await tx.agentAttachmentChunk.create({ data: {
            attachmentId: row.id, pageId: createdPages[chunk.pageIndex]?.id, ordinal: chunk.ordinal,
            text: chunk.text, charCount: chunk.text.length, extractionMethod: chunk.method
          } });
        }
        await tx.agentAttachment.update({
          where: { id: row.id },
          data: {
            status: 'ready', pageCount: pages.length,
            metadata: { extractedCharacters: chunks.reduce((sum, item) => sum + item.text.length, 0), parserVersion: 'deterministic-v1' }
          }
        });
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'ATTACHMENT_EXTRACTION_FAILED';
      await this.prisma.agentAttachment.updateMany({
        where: { id: row.id, userId },
        data: { status: 'failed', errorCode: code.slice(0, 80), errorMessage: this.errorMessage(code) }
      });
      throw error;
    }
  }

  private async extractPdf(path: string) {
    const pdfjs = await importEsm('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = await readFile(path);
    const loadingTask: any = (pdfjs as any).getDocument({ data: new Uint8Array(bytes) });
    const document: any = await loadingTask.promise;
    if (document.numPages > 200) throw new Error('ATTACHMENT_PAGE_LIMIT_EXCEEDED');
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => typeof item.str === 'string' ? item.str : '').filter(Boolean).join(' ');
      pages.push({ pageNumber, width: Math.round(viewport.width), height: Math.round(viewport.height), text, method: text ? 'native_text' : 'none' });
      page.cleanup();
    }
    await loadingTask.destroy();
    return pages;
  }

  private async extractDocx(path: string) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path });
    return [{ pageNumber: 1, width: null, height: null, text: result.value, method: result.value.trim() ? 'native_text' : 'none' }];
  }

  private assertEnabled() {
    if (!this.flags.isWebEnabled() || !this.flags.isAttachmentsEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_ATTACHMENTS_DISABLED', message: 'Agent 附件能力暂未开放。' });
    }
  }

  private errorMessage(code: string) {
    const messages: Record<string, string> = {
      ATTACHMENT_TOO_LARGE: `文件超过 ${Math.round(uploadLimitBytes() / 1024 / 1024)} MB 限制，请压缩或拆分后重试。`,
      ATTACHMENT_EMPTY: '文件为空，请重新选择。',
      ATTACHMENT_SIGNATURE_MISMATCH: '文件内容与扩展名不一致，已安全拒绝。',
      ATTACHMENT_PAGE_LIMIT_EXCEEDED: '文档超过 200 页，请拆分后重试。'
    };
    return messages[code] ?? '附件处理失败，请检查文件后重试。';
  }
}
