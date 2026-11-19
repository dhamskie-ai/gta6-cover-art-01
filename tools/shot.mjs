// Neon Coast Cover Studio — takes the dossier screenshots with Playwright.
// Serves app/ straight from disk through page.route under a made-up host
// (localhost is refused by local-network-access checks on this VM) and waits
// for window.__shotReady before each capture. 2D canvas only, so no WebGL
// policy file is needed.
//
//   node tools/shot.mjs            takes every shot in shots.json
//   node tools/shot.mjs 2-editor   takes just that one
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(REPO, 'app');
const SHOT_DIR = join(REPO, 'screenshots');
const SHOTS = JSON.parse(readFileSync(join(REPO, 'shots.json'), 'utf8'));

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const wanted = process.argv[2] ?? null;
const jobs = SHOTS.filter((shot) => !wanted || shot.name.startsWith(wanted));

if (!jobs.length) {
  console.error(`no shot named ${wanted} in shots.json`);
  process.exit(1);
}

const scrubbedEnv = {
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
  env: scrubbedEnv,
  // Headless Chromium on this VM wants the WebGL policy file at startup
  // (recreate /tmp/webgl-policy.txt after any /tmp wipe: two lines,
  // `hatch-webgl-allowed-domains-v1` then the fake host, trailing newline).
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--use-angle=swiftshader',
    '--no-proxy-server',
    '--hatch-webgl-allowed-domains-file=/tmp/webgl-policy.txt',
    '--hatch-webgl-allowed-domains-sha256=946935b2f40f4e274a02bea764ac855e19e5950a3a1b2b1fa35c9c4fa73130c0',
  ],
});

let failures = 0;
for (const shot of jobs) {
  const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const diskPath = join(APP_DIR, requestPath);
    if (existsSync(diskPath)) {
      await route.fulfill({
        status: 200,
        contentType: CONTENT_TYPES[extname(diskPath)] ?? 'application/octet-stream',
        body: readFileSync(diskPath),
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
  await page.goto(`http://neoncoast.studio/${shot.query}`, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady, null, { timeout: 120000 });
  } catch {
    console.log(shot.name, 'shotReady timeout');
    failures += 1;
  }
  await page.waitForTimeout(500);
  const out = join(SHOT_DIR, shot.name);
  // Quality 80: the film grain is high-frequency noise, and 88 pushed the
  // grainy covers over the 256 KiB screenshot cap.
  await page.screenshot({ path: out, type: 'jpeg', quality: 80, timeout: 120000 });
  console.log(shot.name, '->', out);
  await page.close();
}
await browser.close();
console.log('done, errors:', failures);
process.exit(failures > 0 ? 1 : 0);
