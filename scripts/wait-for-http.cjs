const targetUrl = process.argv[2];
const timeoutMs = Number(process.argv[3] || 90_000);

if (!targetUrl) {
  console.error('Usage: node scripts/wait-for-http.cjs <url> [timeout-ms]');
  process.exit(2);
}

const startedAt = Date.now();

async function waitForHttp() {
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(targetUrl, {
        signal: AbortSignal.timeout(3_000)
      });
      if (response.ok) {
        console.log(`Ready: ${targetUrl}`);
        return;
      }
    } catch {
      // The service may still be compiling or binding its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  console.error(`Timed out waiting for ${targetUrl}`);
  process.exitCode = 1;
}

void waitForHttp();
