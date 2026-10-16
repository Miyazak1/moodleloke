const path = require('node:path');
const { spawn } = require('node:child_process');

function withLocalNoProxy(env, host) {
  const hosts = new Set(
    [env.NO_PROXY, env.no_proxy, '127.0.0.1', 'localhost', host]
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const noProxy = Array.from(hosts).join(',');
  return { ...env, NO_PROXY: noProxy, no_proxy: noProxy };
}

async function main() {
  const port = Number(process.env.E2E_PORT || '5196');
  const host = process.env.E2E_HOST || '127.0.0.1';
  const env = withLocalNoProxy({
    ...process.env,
    VITE_AGENT_WEB_ENABLED: 'true',
    VITE_STANDALONE_AGENT: '1'
  }, host);
  Object.assign(process.env, env);

  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.resolve(__dirname, '..', 'vite.config.mjs'),
    optimizeDeps: { force: true },
    server: { host, port, strictPort: true }
  });
  await server.listen();

  try {
    const cli = path.resolve(__dirname, '..', 'node_modules', '@playwright', 'test', 'cli.js');
    const args = [
      cli,
      'test',
      'e2e/loading-concurrency.spec.ts',
      'e2e/interaction-stability.spec.ts',
      '--config',
      'playwright.config.ts',
      '--workers=1'
    ];
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: path.resolve(__dirname, '..'),
        env: {
          ...env,
          E2E_HOST: host,
          E2E_PORT: String(port),
          E2E_SKIP_WEB_SERVER: '1',
          VITE_AGENT_WEB_ENABLED: 'true',
          VITE_STANDALONE_AGENT: '1'
        },
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
