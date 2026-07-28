import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8109;
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('review/v2.0.5-hotfix');
fs.mkdirSync(outputDir, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'ignore', 'ignore']
});

let browser;
const report = {
  build: 'v2.0.5',
  generatedAt: new Date().toISOString(),
  smoke: null,
  runtimeErrors: []
};

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(`${origin}/index.html`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!ready) throw new Error('local smoke server did not start');

  browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  await page.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });
  await page.addScriptTag({ path: path.resolve('tests/e2e-v205.js') });
  report.smoke = await page.evaluate(() => window.runV205Smoke());
  await page.screenshot({
    path: path.join(outputDir, 'chromium-focused-final.png'),
    fullPage: true
  });
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  fs.writeFileSync(
    path.join(outputDir, 'CHROMIUM_FOCUSED.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
}

console.log(`Chromium focused smoke: ${report.smoke?.pass || 0} passed, ` +
  `${report.smoke?.fail || 0} failed`);
if (!report.smoke || report.smoke.fail || report.runtimeErrors.length) process.exitCode = 1;
