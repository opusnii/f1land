// Kitchen-sink screenshots: node dev/shot-ui.mjs [--url http://127.0.0.1:5173/dev/ui.html] [--dir /tmp/verify/ui] [--lang ru] [--w 390] [--only type,buttons]
import { chromium } from '@playwright/test';
const a = process.argv.slice(2);
const arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const url = arg('url', 'http://127.0.0.1:5173/dev/ui.html');
const dir = arg('dir', '/tmp/verify/ui');
const lang = arg('lang', 'ru');
const only = arg('only');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: +arg('w', 390), height: 844 }, deviceScaleFactor: +arg('dpr', 2) });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('response', (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url()}`));
await page.goto(`${url}?lang=${lang}${only ? `&only=${only}` : ''}`);
await page.waitForLoadState('networkidle');
// Lazy images below the fold: scroll through once so every block is decoded.
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
const blocks = await page.$$('[data-block]');
for (const b of blocks) {
  const id = await b.getAttribute('data-block');
  await b.screenshot({ path: `${dir}/${lang}-${id}.png` });
}
await (await page.$('header.topbar')).screenshot({ path: `${dir}/${lang}-header.png` });
console.log('blocks', blocks.length, errs.length ? `errors: ${errs.slice(0, 5).join(' | ')}` : 'no errors');
await browser.close();
