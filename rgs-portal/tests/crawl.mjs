// Every persona opens every screen they can reach: no script errors, no console errors.
import { startServer, launch, personas, signIn, routesOf, go, reporter } from './lib/harness.mjs';
const srv = await startServer(), b = await launch(), R = reporter('crawl');
for (const id of await personas(b, srv.url)) {
  const ctx = await b.newContext(), page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  await signIn(page, srv.url, id);
  const routes = await routesOf(page);
  for (const r of routes) await go(page, r, 250);
  R.ok(routes.length > 5, `${id}: reached ${routes.length} screens`);
  R.ok(!errs.length, `${id}: ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await b.close(); srv.close(); R.done();
