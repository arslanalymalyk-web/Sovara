// Phone layout: no sideways page scroll, no text under 12px, nothing under the 24px WCAG minimum except inline links.
import { startServer, launch, signIn, routesOf, go, reporter } from './lib/harness.mjs';
const srv = await startServer(), b = await launch(), R = reporter('mobile');
for (const id of ['u-ca', 'u-pm', 'u-adm']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
  await signIn(page, srv.url, id);
  for (const r of await routesOf(page)) {
    await go(page, r, 300);
    const m = await page.evaluate(() => {
      const vis = (e) => { const x = e.getBoundingClientRect(); return x.width > 0 && x.height > 0; };
      const tiny = [...document.querySelectorAll('body *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 11.9).length;
      const ctl = [...document.querySelectorAll('main button,main select,main input:not([type=hidden]):not([type=checkbox]):not([type=radio]),main textarea,.topbar button')].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length;
      return { over: document.documentElement.scrollWidth - innerWidth, tiny, ctl };
    });
    R.ok(m.over <= 1, `${id}#${r}: page ${m.over}px wider than the phone`);
    R.ok(m.tiny === 0, `${id}#${r}: ${m.tiny} text items under 12px`);
    R.ok(m.ctl === 0, `${id}#${r}: ${m.ctl} buttons/fields under 44px`);
  }
  await ctx.close();
}
await b.close(); srv.close(); R.done();
