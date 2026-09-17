import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function cleanSecret(value: unknown) {
  return String(value ?? '').trim();
}

function encryptionSecret() {
  return cleanSecret(process.env.CSCA_ORG_LLM_KEY_SECRET)
    || cleanSecret(process.env.AUTH_SECRET)
    || cleanSecret(process.env.JWT_SECRET);
}

function encryptionKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function encryptApiSecretForStorage(value: unknown) {
  const secret = cleanSecret(value);
  if (!secret) return '';
  if (secret.startsWith(ENCRYPTED_PREFIX) || secret.startsWith('base64:') || secret.startsWith('plain:')) return secret;

  const storeSecret = encryptionSecret();
  if (!storeSecret) return `plain:${secret}`;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(storeSecret), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTED_PREFIX.slice(0, -1),
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url')
  ].join(':');
}

export function decryptApiSecretFromStorage(value: unknown) {
  const raw = cleanSecret(value);
  if (!raw) return '';
  if (raw.startsWith('base64:')) {
    try {
      return Buffer.from(raw.slice('base64:'.length), 'base64').toString('utf8').trim();
    } catch {
      return '';
    }
  }
  if (raw.startsWith('plain:')) return raw.slice('plain:'.length).trim();
  if (!raw.startsWith(ENCRYPTED_PREFIX)) return raw;

  const storeSecret = encryptionSecret();
  if (!storeSecret) return '';
  const parts = raw.split(':');
  if (parts.length !== 5) return '';
  try {
    const [, version, ivText, tagText, ciphertextText] = parts;
    if (version !== 'v1') return '';
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(storeSecret), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final()
    ]).toString('utf8').trim();
  } catch {
    return '';
  }
}

export function apiSecretStorageMode(value: unknown) {
  const raw = cleanSecret(value);
  if (raw.startsWith(ENCRYPTED_PREFIX)) return 'encrypted';
  if (raw.startsWith('base64:')) return 'base64_legacy';
  if (raw.startsWith('plain:')) return 'plain_legacy';
  return raw ? 'raw_legacy' : 'missing';
}
