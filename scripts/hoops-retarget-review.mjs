/* Silent candidate-only review. Serve repo root; URL points to a temporary
 * review page containing window.ready and window.setTime. No game state saved. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const [url, out] = process.argv.slice(2);
if (!url || !out) throw new Error('Usage: node scripts/hoops-retarget-review.mjs URL output-directory');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => !!window.ready, null, { timeout: 60000 });
  const info = await page.evaluate(() => window.ready);
  for (const [index, fraction] of [0, .20, .35, .50, .65, .85].entries()) {
    await page.evaluate(time => window.setTime(time), info.duration * fraction);
    await page.screenshot({ path: `${out}/pose-${index}.png` });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ info, errors, fractions: [0, .20, .35, .50, .65, .85] }, null, 2));
  console.log(JSON.stringify({ info, errors }));
} finally {
  await browser.close();
}
