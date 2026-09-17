import { existsSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export function getAgentAttachmentRoot() {
  return resolve(process.env.AGENT_PRIVATE_UPLOADS_DIR || join(process.cwd(), '.local', 'agent-attachments'));
}

export function ensureAgentAttachmentRoot() {
  const root = getAgentAttachmentRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

export function resolveAgentStorageKey(storageKey: string) {
  const root = getAgentAttachmentRoot();
  const target = resolve(root, storageKey);
  const child = relative(root, target);
  if (!child || child.startsWith('..') || resolve(root, child) !== target) throw new Error('INVALID_ATTACHMENT_STORAGE_KEY');
  return target;
}
