const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

function loadEnvFile(filepath) {
  if (!existsSync(filepath)) return;
  for (const line of readFileSync(filepath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

loadEnvFile(join(__dirname, '..', '.env'));

const prisma = new PrismaClient();

const SAMPLE_PDF_BYTES = Buffer.from('JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9Db3VudCAwID4+CmVuZG9iagp0cmFpbGVyCjw8IC9Sb290IDEgMCBSID4+CiUlRU9G', 'base64');
const UPLOAD_DIR = join(__dirname, '..', 'backend', 'uploads', 'past-papers');

function ensureSamplePdf(filename) {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  const filepath = join(UPLOAD_DIR, filename);
  writeFileSync(filepath, SAMPLE_PDF_BYTES);
  return {
    fileUrl: `/uploads/past-papers/${filename}`,
    originalFilename: filename,
    mimeType: 'application/pdf',
    fileSizeBytes: SAMPLE_PDF_BYTES.length,
    checksum: createHash('sha256').update(SAMPLE_PDF_BYTES).digest('hex')
  };
}

const papers = [
  ['math', 'csca-2026-04-math-paper', 'CSCA 2026年4月数学真题', '4月真题', 2026, '4月', 1],
  ['math', 'csca-2026-03-math-paper', 'CSCA 2026年3月数学真题', '3月真题', 2026, '3月', 2],
  ['math', 'csca-2026-01-math-paper', 'CSCA 2026年1月数学真题', '1月真题', 2026, '1月', 3],
  ['physics', 'csca-2026-04-physics-paper', 'CSCA 2026年4月物理真题', '4月真题', 2026, '4月', 1],
  ['physics', 'csca-2026-03-physics-paper', 'CSCA 2026年3月物理真题', '3月真题', 2026, '3月', 2],
  ['physics', 'csca-2025-12-physics-paper', 'CSCA 2025年12月物理真题', '12月真题', 2025, '12月', 3],
  ['chemistry', 'csca-2026-03-chemistry-paper', 'CSCA 2026年3月化学真题', '3月真题', 2026, '3月', 1],
  ['chemistry', 'csca-2025-12-chemistry-paper', 'CSCA 2025年12月化学真题', '12月真题', 2025, '12月', 2],
  ['chemistry', 'csca-2025-09-chemistry-paper', 'CSCA 2025年9月化学真题', '9月真题', 2025, '9月', 3]
];

async function main() {
  for (const [subject, slug, title, sessionLabel, examYear, examMonth, sortOrder] of papers) {
    const paper = await prisma.pastPaper.upsert({
      where: { slug },
      update: {
        title,
        subject,
        examYear,
        examMonth,
        sessionLabel,
        language: 'zh',
        description: `${title}，当前作为开放下载样例，可在后台替换为正式 PDF、答案和解析文件。`,
        questionCount: 48,
        pageCount: 16,
        hasAnswers: true,
        hasSolutions: true,
        isFree: true,
        isPublished: true,
        isFeatured: true,
        sortOrder
      },
      create: {
        slug,
        title,
        subject,
        examYear,
        examMonth,
        sessionLabel,
        language: 'zh',
        description: `${title}，当前作为开放下载样例，可在后台替换为正式 PDF、答案和解析文件。`,
        questionCount: 48,
        pageCount: 16,
        hasAnswers: true,
        hasSolutions: true,
        isFree: true,
        isPublished: true,
        isFeatured: true,
        sortOrder
      }
    });
    await prisma.pastPaperFile.deleteMany({ where: { pastPaperId: paper.id } });
    const paperFile = ensureSamplePdf(`${slug}-paper.pdf`);
    const solutionsFile = ensureSamplePdf(`${slug}-solutions.pdf`);
    await prisma.pastPaperFile.createMany({
      data: [
        { pastPaperId: paper.id, kind: 'paper', label: `${title} 原卷 PDF`, ...paperFile },
        { pastPaperId: paper.id, kind: 'solutions', label: `${title} 答案与解析 PDF`, ...solutionsFile }
      ]
    });
  }
  console.log(`Seeded ${papers.length} past papers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
