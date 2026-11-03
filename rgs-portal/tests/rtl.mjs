// Arabic / right-to-left: document direction, no raw translation keys, no sideways page scroll (desktop and phone), placeholders translated.
import { startServer, launch, signIn, routesOf, go, reporter } from './lib/harness.mjs';
const srv = await startServer(), b = await launch(), R = reporter('rtl');
for (const [w, h] of [[1360, 900], [390, 844]]) for (const id of ['u-ca', 'u-pm', 'u-qa', 'u-adm']) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }), p = await ctx.newPage();
  await signIn(p, srv.url, id);
  await p.click('.userbtn'); await p.waitForTimeout(300); await p.evaluate(() => [...document.querySelectorAll('[data-act=lang]')].pop().click()); await p.waitForTimeout(600);
  R.ok(await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'), `${id}@${w}: page is rtl / ar`);
  for (const r of await routesOf(p)) {
    await go(p, r, 400);
    const m = await p.evaluate(() => {
      const text = document.body.innerText;
      return { over: document.documentElement.scrollWidth - innerWidth, keys: [...text.matchAll(/(^|\s)((adm|nav|err|rq|doc|ins|cm|rd|ho|rel|dlg|misc|role|svc|fi|tpl|login)\.[a-zA-Z0-9_.]{3,})(?=\s|$)/g)].map((x) => x[2]),
        tbc: /To be confirmed|Project-approved criterion/.test(text) };
    });
    R.ok(m.over <= 1, `${id}@${w}#${r}: page ${m.over}px wider than the screen`);
    R.ok(!m.keys.length, `${id}@${w}#${r}: raw keys ${m.keys.slice(0, 3)}`);
    R.ok(!m.tbc, `${id}@${w}#${r}: placeholder left in English`);
  }
  await ctx.close();
}
await b.close(); srv.close(); R.done();
