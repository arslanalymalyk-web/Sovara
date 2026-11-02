// axe-core (WCAG 2.0/2.1 A+AA and best practice) on every reachable screen, light and dark.
import { startServer, launch, signIn, routesOf, go, reporter, axeSource } from './lib/harness.mjs';
const PERSONAS = ['u-gm', 'u-pm', 'u-qa', 'u-dc', 'u-cr', 'u-ca', 'u-so', 'u-adm'];
const srv = await startServer(), b = await launch(), R = reporter('a11y'), seen = new Set();
for (const scheme of ['light', 'dark']) for (const id of PERSONAS) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: scheme }), page = await ctx.newPage();
  await signIn(page, srv.url, id);
  for (const r of await routesOf(page)) {
    if (seen.has(scheme + r)) continue; seen.add(scheme + r); await go(page, r, 600);
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
    R.ok(!res.violations.length, `${scheme} ${id}#${r}: ` + res.violations.map((v) => v.id + '×' + v.nodes.length).join(', '));
  }
  await ctx.close();
}
await b.close(); srv.close(); R.done();
