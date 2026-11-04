// Update link -> association submits from the portal -> council reviews -> data updated.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const adm = await (await b.newContext()).newPage(); adm.on('pageerror', (e) => errs.push('adm: ' + e.message));
  await adm.goto(BASE + '/'); await adm.waitForTimeout(600);
  const link = await adm.evaluate(async () => (await (await fetch('/api/update-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ association_ids: [24] }) })).json()).links[0]);
  // association on a phone, separate browser context (no session)
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const asc = await ctx.newPage(); asc.on('pageerror', (e) => errs.push('asc: ' + e.message));
  await asc.goto(link.url); await asc.waitForTimeout(900);
  const boot = await asc.evaluate(() => ({ portal: !!PORTAL, open: document.querySelector('#portal').classList.contains('on'), name: PS && PS.a.n, sess: SESSION, raw: RAW.length, pub: assoc.length, secs: PSEC.map((s) => s[0]) }));
  await asc.screenshot({ path: 'tests/out/req_portal.png' });
  await asc.fill('[data-k=about]', 'جمعية صحية متخصصة في خدمات صحة الفم والأسنان للأسر المحتاجة في منطقة عسير.');
  await asc.fill('[data-k=founded]', '2023-03-01'); await asc.dispatchEvent('[data-k=founded]', 'change'); await asc.waitForTimeout(100);
  await asc.setInputFiles('#logoIn', '/tmp/logo.png'); await asc.waitForTimeout(500);
  await asc.evaluate(() => saveProfile()); await asc.waitForTimeout(300);
  await asc.screenshot({ path: 'tests/out/req_submit.png' });
  await asc.fill('#psubf [name=submitter_name]', 'أحمد التجريبي'); await asc.fill('#psubf [name=submitter_role]', 'المدير التنفيذي');
  await asc.click('#psubb'); await asc.waitForTimeout(1500);
  const done = await asc.evaluate(() => ({ modal: document.querySelector('#modal h3')?.textContent, pending: Object.keys(PS.pending) }));
  await asc.screenshot({ path: 'tests/out/req_done.png' });
  // council review
  await adm.evaluate(() => { go('admin'); }); await adm.waitForTimeout(800); await adm.evaluate(() => goMod('updates')); await adm.waitForTimeout(800);
  await adm.screenshot({ path: 'tests/out/req_list.png' });
  await adm.click('[data-rv]'); await adm.waitForTimeout(800);
  await adm.screenshot({ path: 'tests/out/req_review.png' });
  await adm.click('#rvOk'); await adm.waitForTimeout(1200);
  const after = await adm.evaluate(async () => {
    const a = (await (await fetch('/api/associations/24')).json()).data;
    const logo = await fetch('/u-logo/24');
    const list = (await (await fetch('/api/update-requests')).json()).data[0];
    return { founded: a.founded_on, status: list.status, logo: logo.status + ' ' + logo.headers.get('content-type') };
  });
  const bad = await (await b.newContext()).newPage(); await bad.goto(BASE + '/u/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  const badTxt = await bad.textContent('body');
  const reopen = await (await ctx.newPage()); await reopen.goto(link.url); await reopen.waitForTimeout(800);
  const re = await reopen.evaluate(() => ({ about: PS.d.about.slice(0, 20), logo: PS.d.logo, pending: Object.keys(PS.pending) }));
  console.log(JSON.stringify({ boot, done, after, invalid: badTxt.includes('غير صالح'), re, errs }, null, 1));
  await b.close();
})();
