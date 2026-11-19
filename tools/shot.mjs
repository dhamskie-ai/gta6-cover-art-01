// Neon Coast Cover Studio — screenshot runner.
// Reads shots.json, serves app/ straight from disk through page.route
// under a made-up host (localhost is refused here), waits for
// window.__shotReady, and writes a JPEG per shot into screenshots/.
// Quality steps down until every file fits the 256 KiB dossier cap.
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(ROOT, 'app');
const SHOT_DIR = join(ROOT, 'screenshots');
const SHOTS = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

const cleanEnv = {
  ...process.env,
  http_proxy: '',
  https_proxy: '',
  HTTP_PROXY: '',
  HTTPS_PROXY: '',
  all_proxy: '',
  ALL_PROXY: '',
  no_proxy: '*',
  NO_PROXY: '*',
};

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  env: cleanEnv,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--use-angle=swiftshader',
    '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy-neoncoast.txt',
    '--hatch-webgl-allowed-domains-sha256=946935b2f40f4e274a02bea764ac855e19e5950a3a1b2b1fa35c9c4fa73130c0',
  ],
});

let failures = 0;

for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fullPath = join(APP_DIR, requestPath);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      await route.fulfill({
        status: 200,
        contentType: TYPES[extname(fullPath)] || 'application/octet-stream',
        body: readFileSync(fullPath),
      });
    } else {
      console.log(shot.name, 'missing', requestPath);
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures += 1;
      console.log(shot.name, 'console-error:', message.text());
    }
  });
  page.on('pageerror', (error) => {
    failures += 1;
    console.log(shot.name, 'pageerror:', String(error));
  });
  page.on('requestfailed', (request) => {
    failures += 1;
    console.log(shot.name, 'requestfailed:', request.url());
  });

  await page.goto(`http://neoncoast.studio/${shot.query}`, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady, null, { timeout: 60000 });
  } catch {
    console.log(shot.name, 'shotReady timeout');
    failures += 1;
  }
  await page.waitForTimeout(400);

  const target = join(SHOT_DIR, shot.name);
  let quality = 90;
  await page.screenshot({ path: target, type: 'jpeg', quality, timeout: 120000 });
  while (statSync(target).size > 262144 && quality > 55) {
    quality -= 10;
    await page.screenshot({ path: target, type: 'jpeg', quality, timeout: 120000 });
  }
  const bytes = statSync(target).size;
  console.log(shot.name, '->', bytes, 'bytes, quality', quality);
  if (bytes > 262144) failures += 1;
  await page.close();
}

await browser.close();
console.log('done, errors:', failures);
process.exit(failures > 0 ? 1 : 0);
