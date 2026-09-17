import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const command = fileURLToPath(new URL(isWindows ? '../node_modules/.bin/playwright.cmd' : '../node_modules/.bin/playwright', import.meta.url));
const result = spawnSync(
  command,
  [
    'test',
    '--config',
    'playwright.config.ts',
    'e2e/admin-console-parity.spec.ts',
    '-g',
    'source profile pipeline',
    '--project=desktop'
  ],
  {
    cwd: frontendRoot,
    env: {
      ...process.env,
      E2E_PORT: process.env.E2E_PORT || '5198',
      E2E_REUSE_SERVER: process.env.E2E_REUSE_SERVER || 'false'
    },
    stdio: 'inherit',
    shell: isWindows
  }
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
