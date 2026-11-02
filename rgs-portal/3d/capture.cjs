// Captures review viewpoints from the real browser route (screenshot gate).
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:8560/';
const views = [['front', 'white'], ['front', 'white', 'unlit'], ['three-quarter', 'studio'], ['side', 'studio'], ['rear', 'studio'], ['front', 'studio'], ['three-quarter', 'white'], ['side', 'white'], ['rear', 'white'], ['front', 'studio', 'grazing']];
(async()=>{const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 536, height: 536 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
for (const [view, bg, mode] of views) {
  await page.goto(`${base}index.html?view=${view}&bg=${bg}&orbit=0${mode === 'unlit' ? '&unlit=1' : ''}${bg === 'white' ? '&fov=14' : ''}${mode === 'grazing' ? '&lights=grazing' : ''}`);
  await page.waitForFunction(() => window.__IMG2THREEJS_READY__ === true, null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const file = `captures/${view}-${mode ?? bg}.png`.replace('-unlit.png', '-unlit.png');
  await page.screenshot({ path: file });
  console.log('saved', file);
}
console.log('errors:', errors.length, errors.slice(0, 3));
await browser.close();
})();