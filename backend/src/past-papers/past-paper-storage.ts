import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const UPLOAD_URL_PREFIX = '/uploads/past-papers/';

export function getUploadsRoot() {
  // Keep the default stable across `npm --prefix backend`, direct Nest/ts-node
  // startup, and the repository-level dev launcher. `process.cwd()` differs
  // between those entry points, while this module is always two levels below
  // the backend root in both src/ and dist/.
  return resolve(process.env.UPLOADS_DIR || join(__dirname, '..', '..', 'uploads'));
}

export function getPastPaperUploadDir() {
  return join(getUploadsRoot(), 'past-papers');
}

export function ensurePastPaperUploadDir() {
  const dir = getPastPaperUploadDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function buildPastPaperFileUrl(filename: string) {
  return `${UPLOAD_URL_PREFIX}${filename}`;
}

export function resolvePastPaperLocalPath(fileUrl: string) {
  if (!fileUrl.startsWith(UPLOAD_URL_PREFIX)) return null;
  const filename = fileUrl.slice(UPLOAD_URL_PREFIX.length);
  if (!filename || filename.includes('/') || filename.includes('\\')) return null;
  const filepath = resolve(getPastPaperUploadDir(), filename);
  if (!filepath.startsWith(resolve(getPastPaperUploadDir()))) return null;
  return filepath;
}
