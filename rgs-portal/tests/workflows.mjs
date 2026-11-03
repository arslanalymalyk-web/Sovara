// End-to-end workflow checks through the real UI, one persona after another in the same browser profile.
import { startServer, launch, reporter } from './lib/harness.mjs';
const srv = await startServer(), b = await launch(), R = reporter('workflows');
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }), p = await ctx.newPage();
const JPG = { name: 'site.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64') };
const wait = (ms = 600) => p.waitForTimeout(ms);
const go = async (r) => { await p.evaluate((h) => { location.hash = '#' + h; }, r); await wait(700); };
async function as(id) {
  if (!(await p.$('#persona'))) { await p.click('.userbtn'); await wait(300); await p.evaluate(() => document.querySelectorAll('[data-act=signout]')[1].click()); await wait(900); }
  await p.selectOption('#persona', id); await p.click('#login-form [type=submit]'); await p.waitForSelector('a[data-route]', { state: 'attached' }); await wait(1200);
}
const text = (sel = 'main') => p.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, ' ') || '', sel);
const status = () => p.evaluate(() => [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).join(' | '));
const invalid = () => p.evaluate(() => [...document.querySelectorAll('[aria-invalid=true]')].map((e) => e.id).join(','));
await p.goto(srv.url);

// 1. Customer approval: refused without the review confirmation, accepted with it.
await as('u-ca'); await go('decision.act.ACT-106');
await p.click('button:has-text("Record decision")'); await wait();
R.ok((await invalid()).length > 0, 'approval: submitting without the review confirmation is refused');
await p.check('input[type=checkbox]'); await p.click('button:has-text("Record decision")'); await wait(1200);
R.ok(/Decision recorded/.test(await text()), 'approval: decision recorded with the confirmation ticked');

// 2. Request wizard (customer) then triage (project manager).
await as('u-cr'); await go('requests'); await p.click('button:has-text("Raise a request")'); await wait(1200);
await p.click('button:has-text("Continue")'); await wait(); R.ok(/Choose an option/.test(await text()), 'request: first step blocks an empty Continue');
for (const [radio, name] of [['Unit 4 Turnaround', 0], ['Insulation WP-P1-INS-02', 0], ['T-105 · Tank T-105', 0], ['Site issue', 0]]) { await p.getByRole('radio', { name: new RegExp(radio) }).check(); await p.click('button:has-text("Continue")'); await wait(900); }
await p.fill('#w-subject', 'Insulation sheet loose on T-105 east face'); await p.fill('#w-description', 'Cladding sheet has lifted at the east seam; needs inspection first.');
await p.click('button:has-text("Continue")'); await wait(900); await p.click('button:has-text("Continue")'); await wait(1200);
await p.getByRole('button', { name: /^Submit/ }).click(); await wait(1200);
const why = p.getByRole('textbox', { name: /separate request/ });
if (await why.count()) { await why.fill('Different tank and face from the earlier report.'); await p.getByRole('button', { name: /^Submit/ }).click(); await wait(1800); }
R.ok(/Insulation sheet loose on T-105 east face/.test(await text()) && !/Step 7 of 7/.test(await text()), 'request: submitted and opened with its subject');
await as('u-pm'); await go('triage'); await wait(1500); R.ok(/Insulation sheet loose on T-105 east face/.test(await text()), 'triage: new request is in the project manager queue');

// 3. Inspection technical verification (QA inspector).
await as('u-qa'); await go('inspections'); await p.getByRole('link', { name: 'Insulation thickness check – T-104 south' }).first().click(); await wait(1200);
await p.click('button:has-text("Record technical verification")'); await wait(); await p.locator('button:has-text("Record technical verification")').last().click(); await wait();
R.ok(/Choose an outcome/.test(await text()), 'inspection: an outcome is required');
await p.getByRole('radio', { name: 'Verified', exact: true }).check(); await p.check('input[type=checkbox]'); await p.locator('button:has-text("Record technical verification")').last().click(); await wait(1500);
R.ok(/Verification recorded|Completed/.test((await status()) + (await text())), 'inspection: verification recorded');

// 4. Daily update keeps typed text when a photo is attached (regression).
await as('u-so'); await go('dailyupdates'); await p.click('.page-h .btn'); await wait(1000);
await p.selectOption('#du-package', 'wp1'); await wait(900);
await p.getByRole('combobox', { name: 'Area / asset' }).selectOption('a7'); await wait(500);
await p.getByRole('textbox', { name: 'Work completed' }).fill('Erected level 2 lift.');
await p.setInputFiles('input[type=file]', JPG); await wait(2500);
R.ok((await p.getByRole('textbox', { name: 'Work completed' }).inputValue()) === 'Erected level 2 lift.', 'daily update: typed text survives attaching a photo');

// 5. Administration: suspend blocks sign-in, reactivate restores it; audit records both.
await as('u-adm'); await go('users'); await p.getByRole('row', { name: /Reem Al-Saleh/ }).getByRole('button', { name: /Details/ }).click(); await wait();
await p.click('#adm-detail button:has-text("Suspend account")'); await wait(); await p.click('.rd-form button[type=submit]'); await wait();
R.ok(/at least 5 characters/.test(await text()), 'admin: suspending needs a reason');
await p.fill('#f6-reason', 'Contract ended; access removed.'); await p.click('.rd-form button[type=submit]'); await wait(1200);
R.ok(/Suspended/.test(await text('#adm-detail')), 'admin: account suspended');
await go('users'); await p.getByRole('row', { name: /Tariq Mahmood/ }).getByRole('button', { name: /Details/ }).click(); await wait();
R.ok(!(await p.$('#adm-detail button:has-text("Suspend account")')), 'admin: cannot suspend your own account');
await p.click('.userbtn'); await wait(300); await p.evaluate(() => document.querySelectorAll('[data-act=signout]')[1].click()); await wait(900);
await p.selectOption('#persona', 'u-cv'); await p.click('#login-form [type=submit]'); await wait(1200);
R.ok(!!(await p.$('#persona')) && /suspended/i.test(await text('body')), 'admin: a suspended person is refused at sign-in');
await as('u-adm'); await go('users'); await p.getByRole('row', { name: /Reem Al-Saleh/ }).getByRole('button', { name: /Details/ }).click(); await wait();
await p.click('#adm-detail button:has-text("Reactivate account")'); await wait(1200);
await go('audit'); R.ok(/admin\.user\.status/.test(await text()), 'admin: the audit log shows the status changes');

// 6. Support (customer): needs a scope-free permission check, so customers must be able to send.
await as('u-cr'); await go('support'); await p.click('button:has-text("New support request")'); await wait();
await p.selectOption('#f6-category', 'data'); await p.fill('#f6-subject', 'Progress looks out of date'); await p.fill('#f6-message', 'The progress figure has not changed since last week.');
await p.click('.rd-form button[type=submit]'); await wait(1500);
R.ok(/SUP-0001/.test(await text()), 'support: a customer can send a request and sees it listed');
await b.close(); srv.close(); R.done();
