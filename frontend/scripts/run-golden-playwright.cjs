const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const port = Number(process.env.E2E_PORT || '5198');
  const host = process.env.E2E_HOST || '127.0.0.1';
  process.env.VITE_AGENT_WEB_ENABLED = 'true';
  process.env.VITE_STANDALONE_AGENT = '1';
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.resolve(__dirname, '..', 'vite.config.mjs'),
    optimizeDeps: { force: true },
    server: { host, port, strictPort: true }
  });
  await server.listen();
  try {
    const cli = path.resolve(__dirname, '..', 'node_modules', '@playwright', 'test', 'cli.js');
    const args = [cli, 'test', ...process.argv.slice(2), '--config', 'playwright.golden.config.ts'];
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, VITE_AGENT_WEB_ENABLED: 'true', VITE_STANDALONE_AGENT: '1' },
        stdio: 'inherit',
        shell: false
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    process.exitCode = exitCode;
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
