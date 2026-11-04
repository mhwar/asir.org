// Dashboard directory: logo avatars, row menu, full record editing (profile, contacts, board), logo upload, print.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700);
  await p.evaluate(() => { go('admin'); }); await p.waitForTimeout(500);
  await p.evaluate(() => { ADM.dir.q = 'ابتسامة'; goMod('directory'); }); await p.waitForTimeout(500);
  const avatar = await p.evaluate(() => !!document.querySelector('tr.cl .jav2.lg img'));
  await p.click('[data-more]'); await p.waitForTimeout(200);
  const menu = await p.evaluate(() => [...document.querySelectorAll('#rmenu button')].map((x) => x.textContent));
  await p.screenshot({ path: 'tests/out/rec_menu.png' });
  await p.click('#rmenu [data-a=edit]'); await p.waitForTimeout(900);
  await p.screenshot({ path: 'tests/out/rec_edit.png' });
  await p.click('.recnav [data-rs=lead]'); await p.waitForTimeout(500);
  await p.fill('[name="c.pres"]', 'د. سالم التجريبي'); await p.fill('[name="c.presEmail"]', 'chair@example.org');
  await p.click('#recAddM'); await p.fill('#recBoard .bm:last-child [data-b=name]', 'عضو تجريبي'); await p.fill('#recBoard .bm:last-child [data-b=role]', 'أمين الصندوق');
  await p.click('.recnav [data-rs=prof]'); await p.waitForTimeout(300);
  await p.fill('[name="p.progs"]', 'برنامج الرعاية الفموية\nحملات التوعية');
  await p.click('#recBen button:nth-child(8)');
  const dirty = await p.textContent('#recDirty');
  await p.screenshot({ path: 'tests/out/rec_lead.png' });
  await p.click('#recSave'); await p.waitForTimeout(1200);
  const full = await p.evaluate(async () => (await (await fetch('/api/associations/24/full')).json()).data);
  const dbo = await p.evaluate(() => ({ pres: DBI[24].pres, st: DBI[24].st }));
  // logo upload via full modal
  await p.evaluate(() => recEdit(24, 'prof')); await p.waitForTimeout(800);
  await p.setInputFiles('#recLogo', '/tmp/logo.png'); await p.waitForTimeout(1500);
  const logo = await p.evaluate(() => LOGO[24]);
  await p.evaluate(() => closeAll());
  // print
  await p.evaluate(() => recPrint(24)); await p.waitForTimeout(600);
  await p.screenshot({ path: 'tests/out/rec_print.png' });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('#prF [data-fmt=xlsx]')]);
  // mobile modal
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await m.goto(BASE + '/'); await m.waitForTimeout(600); await m.evaluate(() => { go('admin'); }); await m.waitForTimeout(400);
  await m.evaluate(() => recEdit(24)); await m.waitForTimeout(900); await m.screenshot({ path: 'tests/out/rec_mobile.png' });
  const audit = await p.evaluate(async () => (await (await fetch('/api/audit?entity=association_contacts&limit=3')).json()).data.map((x) => x.action + ':' + (x.after_json || '')));
  console.log(JSON.stringify({ avatar, menu, dirty, saved: { pres: full.contacts.pres, board: full.contacts.board, ben: full.profile.ben, progs: full.profile.progs }, dbo, logo, xlsx: dl && dl.suggestedFilename(), audit, errs }, null, 1));
  await b.close();
})();
