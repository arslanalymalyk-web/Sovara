// Administration end to end: grant authority, change role, organisations, support replies, audit. Includes axe on the open forms.
import { startServer, launch, reporter, axeSource } from './lib/harness.mjs';
const srv = await startServer(), b = await launch(), R = reporter('admin2');
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }), p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const axeNow = async (label) => { await p.evaluate(axeSource); const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })); R.ok(!r.violations.length, 'axe ' + label + ': ' + r.violations.map(v => v.id + '×' + v.nodes.length).join(', ')); };
const wait = (ms = 600) => p.waitForTimeout(ms), go = async r => { await p.evaluate(h => location.hash = '#' + h, r); await wait(700); };
async function as(id) { if (!(await p.$('#persona'))) { await p.click('.userbtn'); await wait(300); await p.evaluate(() => document.querySelectorAll('[data-act=signout]')[1].click()); await wait(900); } await p.selectOption('#persona', id); await p.click('#login-form [type=submit]'); await p.waitForSelector('a[data-route]', { state: 'attached' }); await wait(1200); }
const txt = (s = 'main') => p.evaluate(s => document.querySelector(s)?.innerText.replace(/\s+/g, ' ') || '', s);
const errsOn = () => p.evaluate(() => [...document.querySelectorAll('.rd-form .field-error,.rd-form [role=alert]')].map(e => e.textContent.trim()).join(' | '));
await p.goto(srv.url); await as('u-adm');
// ---- grant authority
await go('roles'); await p.click('button:has-text("Grant authority")'); await wait();
await p.click('.rd-form button[type=submit]'); await wait(); R.ok((await errsOn()).includes('Choose an option'), 'grant: empty form is refused'); await axeNow('grant form with errors');
await p.selectOption('#f6-action', 'handover.signoff'); await wait();
const holders = await p.$$eval('#f6-userId option', o => o.map(x => x.textContent));
R.ok(holders.some(h => /Khalid Al-Harbi/.test(h)) && !holders.some(h => /Reem/.test(h)), 'grant: only eligible people are offered for the chosen permission');
await p.selectOption('#f6-userId', 'u-gm'); await p.selectOption('#f6-projectId', 'p4'); await p.fill('#f6-validTo', '2030-01-01'); await p.selectOption('#f6-nominatedBy', 'u-om');
await p.click('.rd-form button[type=submit]'); await wait(900); R.ok(/12 months/.test(await errsOn()), 'grant: an end date beyond 12 months is refused');
const d = new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10); await p.fill('#f6-validTo', d);
await p.selectOption('#f6-projectId', 'p1'); await p.click('.rd-form button[type=submit]'); await wait(1500);
R.ok(/DA-80\d\d/.test(await txt()), 'grant: authority recorded with a reference');
await p.click('button:has-text("Grant authority")'); await wait(); await p.selectOption('#f6-action', 'handover.signoff'); await wait(); await p.selectOption('#f6-userId', 'u-gm'); await p.selectOption('#f6-projectId', 'p1'); await p.fill('#f6-validTo', d); await p.selectOption('#f6-nominatedBy', 'u-om'); await p.click('.rd-form button[type=submit]'); await wait(900);
R.ok(/already has this authority/.test(await errsOn()), 'grant: a duplicate grant is refused');
// ---- role change
await go('users'); await p.getByRole('row', { name: /Bilal Ahmed/ }).getByRole('button', { name: /Details/ }).click(); await wait();
await p.click('#adm-detail button:has-text("Change role")'); await wait(); await p.click('.rd-form button[type=submit]'); await wait();
R.ok((await errsOn()).length > 0, 'role: empty change is refused'); await axeNow('role form with errors');
const roleOpts = await p.$$eval('#f6-role option', o => o.map(x => x.textContent)); R.ok(!roleOpts.some(r => /Customer/.test(r)), 'role: staff cannot be given a customer role');
await p.selectOption('#f6-role', 'qa_qc_inspector'); await wait(); await p.selectOption('#f6-projectId', 'p1'); await p.fill('#f6-reason', 'Moved to quality team.'); await p.click('.rd-form button[type=submit]'); await wait(1500);
R.ok(/QA\/QC inspector/.test(await txt('#adm-detail')), 'role: role changed and shown in the detail');
await p.click('a[data-route=users]'); // own role cannot be changed
await go('users'); await p.getByRole('row', { name: /Tariq Mahmood/ }).getByRole('button', { name: /Details/ }).click(); await wait();
R.ok(!(await p.$('#adm-detail button:has-text("Change role")')), 'role: you cannot change your own role');
// ---- organisations
await go('orgs'); await p.click('button:has-text("New organisation")'); await wait(); await p.click('.rd-form button[type=submit]'); await wait(); R.ok(/at least 2/.test(await errsOn()), 'org: a name is required'); await axeNow('organisation form with errors');
await p.fill('#f6-name', 'Gulf Marine Works'); await p.fill('#f6-nameAr', 'الخليج للأعمال البحرية'); await p.click('.rd-form button[type=submit]'); await wait(1300);
R.ok(/Gulf Marine Works/.test(await txt()), 'org: organisation created and listed');
await p.getByRole('row', { name: /Gulf Marine Works/ }).getByRole('button', { name: /Rename/ }).click(); await wait(); await p.fill('#f6-name', 'Gulf Marine Works LLC'); await p.click('.rd-form button[type=submit]'); await wait(1300);
R.ok(/Gulf Marine Works LLC/.test(await txt()), 'org: rename saved');
await p.click('button:has-text("New organisation")'); await wait(); await p.fill('#f6-name', 'gulf marine works llc'); await p.click('.rd-form button[type=submit]'); await wait(900); R.ok(/already exists/.test(await errsOn()), 'org: a duplicate name is refused');
await p.getByRole('row', { name: /^RGS|RGS RGS/ }).first().isVisible().catch(() => 0);
// ---- support: customer asks, staff replies and resolves, customer sees it
await as('u-cr'); await go('support'); await p.click('button:has-text("New support request")'); await wait(); await p.selectOption('#f6-category', 'access'); await p.fill('#f6-subject', 'Cannot see my project'); await p.fill('#f6-message', 'After sign-in my project list is empty.'); await p.click('.rd-form button[type=submit]'); await wait(1300);
await as('u-adm'); await go('support'); await p.getByRole('button', { name: 'Cannot see my project' }).click(); await wait();
await p.fill('#f6-message', 'We have added you to the project; please sign in again.'); await p.click('.rd-form button[type=submit]'); await wait(1300);
await axeNow('support ticket thread');
R.ok(/please sign in again/.test(await txt('#adm-ticket')) && /In progress/.test(await txt('#adm-ticket')), 'support: staff reply is shown and the request moves to In progress');
await p.click('#adm-ticket button:has-text("Mark resolved")'); await wait(1000); R.ok(/Resolved/.test(await txt('#adm-ticket')), 'support: staff can resolve');
await as('u-cr'); await go('support'); await p.getByRole('button', { name: 'Cannot see my project' }).click(); await wait();
R.ok(/please sign in again/.test(await txt('#adm-ticket')), 'support: the customer sees the staff reply');
R.ok(!(await p.$('#adm-ticket button:has-text("Mark resolved")')), 'support: a customer has no staff buttons');
await p.click('#adm-ticket button:has-text("Reply and reopen")'); await wait(); await p.fill('#f6-message', 'Still empty.'); await p.click('.rd-form button[type=submit]'); await wait(1300);
R.ok(/Open/.test(await txt('#adm-ticket')), 'support: a customer reply reopens a resolved request');
// ---- audit
await as('u-adm'); await go('audit'); const a = await txt(); R.ok(/authority\.grant/.test(a) && /admin\.user\.role/.test(a) && /admin\.org\.create/.test(a) && /support\.status/.test(a), 'audit: all new actions are recorded');
R.ok(!errs.length, 'no script errors: ' + errs.slice(0, 2).join(' | '));
await b.close(); srv.close(); R.done();
