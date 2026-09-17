const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const { AgentAttachmentService } = require('../dist/backend/src/agent/agent-attachment.service');

function createStore() {
  const attachments = [];
  const pages = [];
  const chunks = [];
  let sequence = 0;
  const matches = (row, where) => {
    if (where.id && row.id !== where.id) return false;
    if (where.userId && row.userId !== where.userId) return false;
    if (where.conversationId && row.conversationId !== where.conversationId) return false;
    if (where.deletedAt === null && row.deletedAt != null) return false;
    if (where.status && typeof where.status === 'string' && row.status !== where.status) return false;
    return true;
  };
  const db = {
    async $transaction(value) {
      if (typeof value === 'function') return value(db);
      return Promise.all(value);
    },
    agentConversation: {
      async findFirst({ where }) {
        return where.id === 'conv-1' && where.userId === 7 ? { id: 'conv-1' } : null;
      }
    },
    agentAttachment: {
      async create({ data }) {
        const row = { id: `attachment-${++sequence}`, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...data };
        attachments.push(row);
        return row;
      },
      async findFirst({ where }) {
        const row = attachments.find((item) => matches(item, where));
        if (!row) return null;
        return { ...row, pages: pages.filter((item) => item.attachmentId === row.id), _count: { messages: 0 } };
      },
      async findMany({ where }) {
        return attachments.filter((item) => matches(item, where)).map((row) => ({
          ...row, pages: pages.filter((item) => item.attachmentId === row.id), _count: { messages: 0 }
        }));
      },
      async update({ where, data }) {
        const row = attachments.find((item) => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      async updateMany({ where, data }) {
        const rows = attachments.filter((item) => matches(item, where));
        rows.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
        return { count: rows.length };
      }
    },
    agentAttachmentPage: {
      async create({ data }) { const row = { id: `page-${pages.length + 1}`, createdAt: new Date(), ...data }; pages.push(row); return row; },
      async deleteMany({ where }) { const kept = pages.filter((item) => item.attachmentId !== where.attachmentId); pages.splice(0, pages.length, ...kept); return { count: 1 }; }
    },
    agentAttachmentChunk: {
      async create({ data }) { const row = { id: `chunk-${chunks.length + 1}`, ...data }; chunks.push(row); return row; },
      async deleteMany({ where }) { const kept = chunks.filter((item) => item.attachmentId !== where.attachmentId); chunks.splice(0, chunks.length, ...kept); return { count: 1 }; }
    },
    agentMessageAttachment: { async count() { return 0; } },
    studentExamOutcomeEvidence: { async count() { return 0; } }
  };
  return { db, attachments, pages };
}

function requestFor(buffer, mime) {
  const stream = Readable.from(buffer);
  stream.headers = { 'content-type': mime, 'content-length': String(buffer.length) };
  return stream;
}

function simplePdf(text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${33 + text.length} >>\nstream\nBT /F1 12 Tf 40 120 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { output += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}

async function main() {
  const root = mkdtempSync(join(tmpdir(), 'cscalite-agent-attachments-'));
  process.env.AGENT_PRIVATE_UPLOADS_DIR = root;
  process.env.CSCA_AGENT_ATTACHMENTS_ENABLED = 'true';
  process.env.AGENT_WEB_ENABLED = 'true';
  const store = createStore();
  const flags = { isWebEnabled: () => true, isAttachmentsEnabled: () => true };
  const service = new AgentAttachmentService(store.db, flags);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  try {
    const ready = await service.upload(7, 'conv-1', requestFor(png, 'image/png'), encodeURIComponent('手写答案.png'), 'image/png');
    assert.equal(ready.status, 'ready');
    assert.equal(ready.detectedMime, 'image/png');
    assert.equal(ready.pageCount, 1);
    assert.match(ready.previewUrl, /\/content$/);
    assert.equal((await service.content(7, ready.id)).size, png.length);
    await assert.rejects(() => service.get(8, ready.id), /Attachment not found/);
    await assert.rejects(() => service.list(8, 'conv-1'), /Agent conversation not found/);

    await assert.rejects(
      () => service.upload(7, 'conv-1', requestFor(png, 'application/pdf'), 'fake.pdf', 'application/pdf'),
      /文件内容与扩展名不一致/
    );
    assert.equal(store.attachments.at(-1).status, 'rejected');
    assert.equal(store.attachments.at(-1).storageKey, undefined);

    const pdf = simplePdf('Hello CSCA');
    const document = await service.upload(7, 'conv-1', requestFor(pdf, 'application/pdf'), 'notes.pdf', 'application/pdf');
    assert.equal(document.status, 'ready');
    assert.equal(document.pageCount, 1);
    assert.equal(document.pages[0].textAvailable, true);

    const removed = await service.remove(7, ready.id);
    assert.equal(removed.status, 'deleted');
    await assert.rejects(() => service.get(7, ready.id), /Attachment not found/);
    console.log('Agent private attachment tests passed.');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
