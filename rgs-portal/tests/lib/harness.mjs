// Shared harness: serves rgs-portal/ statically, launches Chromium, signs in as a persona.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
export const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

export async function startServer() {
  const srv = http.createServer((q, r) => {
    let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    if (p.endsWith(path.sep)) p += 'index.html';
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); } });
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}
export async function launch() {
  const executablePath = process.env.PW_CHROMIUM_PATH || undefined; // CI installs its own browser; this sandbox points at a preinstalled one
  return chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}
export async function personas(b, url) {
  const p = await b.newPage(); await p.goto(url);
  const ids = await p.$$eval('#persona option', (o) => o.map((x) => x.value).filter(Boolean)); await p.close(); return ids;
}
export async function signIn(page, url, id) {
  await page.goto(url); await page.selectOption('#persona', id); await page.click('#login-form [type=submit]');
  await page.waitForSelector('a[data-route]', { state: 'attached' });
}
export async function routesOf(page, skip = /^(ds|model|matrix|tester|states|arch)$/) {
  return page.$$eval('a[data-route]', (e) => [...new Set(e.map((x) => x.dataset.route))]).then((l) => l.filter((r) => !skip.test(r)));
}
export async function go(page, route, wait = 350) { await page.evaluate((h) => { location.hash = '#' + h; }, route); await page.waitForTimeout(wait); }
export function reporter(name) {
  const fails = []; let passes = 0;
  return {
    ok(cond, msg) { if (cond) passes++; else { fails.push(msg); console.log('  FAIL', msg); } },
    done() { console.log(`${name}: ${passes} passed, ${fails.length} failed`); if (fails.length) { process.exitCode = 1; } return fails.length; },
  };
}
