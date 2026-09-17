const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function main() {
  loadEnv();
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_BOOTSTRAP_EMAIL must be set to a valid email.');
  }
  if (!password || password.length < 6) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be set and at least 6 characters.');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'admin',
          status: 'active',
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          passwordHash: await hashPassword(password)
        }
      });
      console.log(`Admin bootstrap restored ${updated.email ?? email} as active admin.`);
      return;
    }

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: 'admin',
        status: 'active',
        emailVerifiedAt: new Date(),
        displayName: email.split('@')[0]
      }
    });
    console.log(`Admin bootstrap created ${created.email ?? email} as active admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Admin bootstrap failed: ${error.message}`);
  process.exit(1);
});
