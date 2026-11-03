// End-to-end check of the deployed shape: Worker + D1 + injected session.
// Run against `npm run dev` (wrangler dev on :8787) or set BASE=https://…
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(800);
  const pub = await p.evaluate(() => ({ assoc: assoc.length, raw: RAW.length, session: SESSION && SESSION.email }));
  await p.evaluate(() => { localStorage.clear(); go('admin'); }); await p.waitForTimeout(500);
  const dash = await p.evaluate(() => ({ auth: ADM.auth, role: ADM.role, login: !!document.querySelector('#admGo'), db: DB.length,
    av: document.querySelector('.jav')?.textContent.slice(0, 40) }));
  await p.screenshot({ path: 'tests/out/platform_home.png' });
  await p.hover('.jav'); await p.waitForTimeout(200); await p.screenshot({ path: 'tests/out/platform_menu.png' });
  await p.evaluate(() => goMod('directory')); await p.waitForTimeout(300); await p.screenshot({ path: 'tests/out/platform_dir.png' });
  const mods = await p.evaluate(() => MODS.map((m) => m[0])); const empty = [];
  for (const m of mods) { await p.evaluate((x) => goMod(x), m); await p.waitForTimeout(80);
    if ((await p.evaluate(() => document.querySelector('#acontent').innerHTML.length)) < 50) empty.push(m); }
  // API round trip: edit, read back, audit, revert
  const api = await p.evaluate(async () => {
    const h = { 'Content-Type': 'application/json' };
    const a = await (await fetch('/api/associations/24')).json();
    const orig = a.data.founded_on;
    const up = await (await fetch('/api/associations/24', { method: 'PATCH', headers: h, body: JSON.stringify({ founded_on: '2023-03-10' }) })).json();
    const bad = await fetch('/api/associations/24', { method: 'PATCH', headers: h, body: JSON.stringify({ phone: '05' }) });
    const badDate = await fetch('/api/associations/24', { method: 'PATCH', headers: h, body: JSON.stringify({ founded_on: '2023-13-40' }) });
    await fetch('/api/associations/24', { method: 'PATCH', headers: h, body: JSON.stringify({ founded_on: orig }) });
    const hist = await (await fetch('/api/associations/24')).json();
    return { changed: up.changed, unknownField: bad.status, badDate: badDate.status, history: hist.history.slice(0, 2).map((x) => x.action + ':' + x.after_json) };
  });
  console.log(JSON.stringify({ pub, dash, modules: mods.length, empty, api, errs }, null, 1));
  await b.close();
})();
