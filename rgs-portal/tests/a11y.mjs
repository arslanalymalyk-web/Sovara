// axe-core (WCAG 2.0/2.1 A+AA and best practice) on every reachable screen, light and dark, including record-detail pages:
// from each screen the suite follows up to two record links per kind (corrective action, inspection, change, project, decision, ...).
import { startServer, launch, signIn, routesOf, go, reporter, axeSource } from './lib/harness.mjs';
const PERSONAS = ['u-gm', 'u-pm', 'u-qa', 'u-dc', 'u-cr', 'u-ca', 'u-so', 'u-adm'];
const srv = await startServer(), b = await launch(), R = reporter('a11y'), seen = new Set();
let screens = 0;
for (const scheme of ['light', 'dark']) for (const id of PERSONAS) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }), page = await ctx.newPage();
  await signIn(page, srv.url, id);
  const check = async (r) => {
    if (seen.has(scheme + r)) return []; seen.add(scheme + r); await go(page, r, 700);
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.waitForTimeout(150);
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
    screens++; R.ok(!res.violations.length, `${scheme} ${id}#${r}: ` + res.violations.map((v) => v.id + '×' + v.nodes.length + ' [' + v.nodes.slice(0, 2).map((n) => n.html.slice(0, 90)).join(' | ') + ']').join(', '));
    return page.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)))].filter((h) => /^[a-z]+\.[A-Za-z0-9._-]+$/.test(h)));
  };
  const records = {};
  for (const r of await routesOf(page)) for (const h of await check(r)) { const kind = h.split('.')[0]; (records[kind] ||= new Set()).add(h); }
  for (const kind of Object.keys(records)) for (const h of [...records[kind]].slice(0, 2)) await check(h);
  // the not-found screen, and (for a customer) the denied screen for projects that belong to another organisation
  await check('req.nope');
  if (id === 'u-cr') for (const p of ['p1', 'p2', 'p3', 'p4']) await check('project.' + p);
  await ctx.close();
}
console.log(`a11y: ${screens} screens checked`);
await b.close(); srv.close(); R.done();
